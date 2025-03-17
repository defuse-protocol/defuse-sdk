import { useQuery } from "@tanstack/react-query"
import { Err, Ok, type Result } from "@thames/monads"
import { providers } from "near-api-js"
import type { CodeResult } from "near-api-js/lib/providers/provider"
import { type ReactNode, useMemo, useState } from "react"
import * as v from "valibot"
import { WidgetRoot } from "../../../components/WidgetRoot"
import { config } from "../../../config"
import type { DefuseUserId, SignerCredentials } from "../../../core/formatters"
import { logger } from "../../../logger"
import { SwapWidgetProvider } from "../../../providers/SwapWidgetProvider"
import { getDepositedBalances } from "../../../services/defuseBalanceService"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { ChainType } from "../../../types/deposit"
import type { SendNearTransaction } from "../../machines/publicKeyVerifierMachine"
import { fetchProtocolFee } from "../actors/otcMakerConfigLoadActor"
import { SignIntentActorProvider } from "../providers/SignIntentActorProvider"
import { useOtcTakerTrades } from "../stores/otcTakerTrades"
import type { SignMessage } from "../types/sharedTypes"
import {
  type DeriveTradeTermsErr,
  type DetermineInvolvedTokensErr,
  type TradeTerms,
  deriveTradeTerms,
  determineInvolvedTokens,
} from "../utils/deriveTradeTerms"
import { genLocalTradeId } from "../utils/genLocalTradeId"
import { OtcTakerForm } from "./OtcTakerForm"
import { OtcTakerInvalidOrder } from "./OtcTakerInvalidOrder"
import { OtcTakerSuccessScreen } from "./OtcTakerSuccessScreen"

export type OtcTakerWidgetProps = {
  multiPayload: string

  /** List of available tokens for trading */
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]

  /** User's wallet address */
  userAddress: string | null | undefined
  userChainType: ChainType | null | undefined

  /** Sign message callback */
  signMessage: SignMessage

  /** Send NEAR transaction callback */
  sendNearTransaction: SendNearTransaction

  /** Theme selection */
  theme?: "dark" | "light"

  /** Frontend referral */
  referral?: string
}

export function OtcTakerWidget(props: OtcTakerWidgetProps) {
  return (
    <WidgetRoot>
      <SwapWidgetProvider>
        <div className="widget-container rounded-2xl bg-gray-1 p-5 shadow">
          <OtcTakerScreens {...props} />
        </div>
      </SwapWidgetProvider>
    </WidgetRoot>
  )
}

function OtcTakerScreens({
  multiPayload,
  tokenList,
  userAddress,
  userChainType,
  signMessage,
  sendNearTransaction,
  referral,
}: OtcTakerWidgetProps) {
  const loading = <div>Loading...</div>

  const signerCredentials: SignerCredentials | null =
    userAddress != null && userChainType != null
      ? { credential: userAddress, credentialType: userChainType }
      : null

  const { data: protocolFee } = useQuery({
    queryKey: ["protocol_fee"],
    queryFn: fetchProtocolFee,
  })

  const enrichedTradeTerms = useMemo(() => {
    if (protocolFee == null) {
      return null
    }

    const result = deriveTradeTerms(multiPayload, protocolFee)
      .mapErr<DeriveTradeTermsErr | DetermineInvolvedTokensErr>((a) => a)
      .andThen((tradeTerms) => {
        return determineInvolvedTokens(
          tokenList,
          tradeTerms.takerTokenDiff
        ).map((tokens) => ({
          ...tokens,
          tradeTerms,
        }))
      })

    if (result.isErr()) {
      logger.error(result.unwrapErr())
    }

    return result
  }, [multiPayload, tokenList, protocolFee])

  const [publishResult, setPublishResult] = useState<{
    intentHashes: string[]
  } | null>(null)

  const tradeId = genLocalTradeId(multiPayload)

  const knownOtcTakerTrade = useOtcTakerTrades((state) => state.trades[tradeId])

  if (enrichedTradeTerms == null || protocolFee == null) {
    return loading
  }

  return enrichedTradeTerms.match({
    ok: ({ tradeTerms, tokenIn, tokenOut }) =>
      publishResult != null ? (
        <OtcTakerSuccessScreen
          tradeTerms={tradeTerms}
          intentHashes={publishResult.intentHashes}
          tokenIn={tokenIn}
          tokenOut={tokenOut}
        />
      ) : knownOtcTakerTrade?.status === "completed" ? (
        <OtcTakerSuccessScreen
          tradeTerms={tradeTerms}
          intentHashes={knownOtcTakerTrade.intentHashes}
          tokenIn={tokenIn}
          tokenOut={tokenOut}
        />
      ) : (
        <OtcTakerValidationOrder
          tradeTerms={tradeTerms}
          tokenIn={tokenIn}
          tokenOut={tokenOut}
          fallback={loading}
        >
          <SignIntentActorProvider sendNearTransaction={sendNearTransaction}>
            <OtcTakerForm
              tradeId={tradeId}
              tradeTerms={tradeTerms}
              tokenIn={tokenIn}
              tokenOut={tokenOut}
              makerMultiPayload={tradeTerms.makerMultiPayload}
              signerCredentials={signerCredentials}
              signMessage={signMessage}
              protocolFee={protocolFee}
              onSuccessTrade={setPublishResult}
              referral={referral}
            />
          </SignIntentActorProvider>
        </OtcTakerValidationOrder>
      ),
    err: (error) => <OtcTakerInvalidOrder error={error} />,
  })
}

function OtcTakerValidationOrder({
  tradeTerms,
  tokenIn,
  tokenOut,
  fallback,
  children,
}: {
  tradeTerms: TradeTerms
  tokenIn: BaseTokenInfo | UnifiedTokenInfo
  tokenOut: BaseTokenInfo | UnifiedTokenInfo
  fallback: ReactNode
  children: ReactNode
}) {
  let error: Result<true, string> = Ok(true)

  if (new Date(tradeTerms.deadline) < new Date()) {
    error = Err("ORDER_EXPIRED")
  }

  const makerBalanceValidation = useQuery({
    enabled: error.isOk(),
    queryKey: [
      "deposited_balance",
      tradeTerms.makerUserId,
      Object.keys(tradeTerms.makerTokenDiff),
    ],
    queryFn: () => {
      return getDepositedBalances(
        tradeTerms.makerUserId as DefuseUserId,
        Object.keys(tradeTerms.makerTokenDiff),
        new providers.JsonRpcProvider({
          url: "https://nearrpc.aurora.dev",
        })
      )
    },
    select: (makerTokenBalances): Result<true, "MAKER_INSUFFICIENT_FUNDS"> => {
      for (const [tokenId, amount] of Object.entries(
        tradeTerms.makerTokenDiff
      )) {
        if (amount >= 0) {
          continue
        }

        const balance = makerTokenBalances[tokenId]

        if (balance == null || balance < -amount) {
          return Err("MAKER_INSUFFICIENT_FUNDS")
        }
      }
      return Ok(true)
    },
  })

  const nonceValidation = useQuery({
    enabled: error.isOk(),
    queryKey: [
      "nonce_is_used",
      tradeTerms.makerUserId,
      tradeTerms.makerNonceBase64,
    ],
    queryFn: async () => {
      const nearClient = new providers.JsonRpcProvider({
        url: "https://nearrpc.aurora.dev",
      })
      const output = await nearClient.query<CodeResult>({
        request_type: "call_function",
        account_id: config.env.contractID,
        method_name: "is_nonce_used",
        args_base64: btoa(
          JSON.stringify({
            account_id: tradeTerms.makerUserId,
            nonce: tradeTerms.makerNonceBase64,
          })
        ),
        finality: "optimistic",
      })

      const stringData = String.fromCharCode(...output.result)
      return v.parse(v.boolean(), JSON.parse(stringData))
    },
    select: (nonceIsUsed): Result<true, "NONCE_ALREADY_USED"> => {
      return nonceIsUsed ? Err("NONCE_ALREADY_USED") : Ok(true)
    },
  })

  if (
    error.isErr() ||
    makerBalanceValidation.data?.isErr() ||
    nonceValidation.data?.isErr()
  ) {
    const noError = Ok(true) as typeof error
    error = noError
      .andThen(() => nonceValidation.data ?? noError)
      .andThen(() => error)
      .andThen(() => makerBalanceValidation.data ?? noError)

    return (
      <OtcTakerInvalidOrder
        error={error.unwrapErr()}
        tradeTerms={tradeTerms}
        tokenIn={tokenIn}
        tokenOut={tokenOut}
      />
    )
  }

  if (makerBalanceValidation.data == null || nonceValidation.data == null) {
    return fallback
  }

  return children
}
