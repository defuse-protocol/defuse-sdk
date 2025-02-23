import { useQuery } from "@tanstack/react-query"
import { providers } from "near-api-js"
import { type ReactNode, useMemo } from "react"
import { WidgetRoot } from "../../../components/WidgetRoot"
import { logger } from "../../../logger"
import { SwapWidgetProvider } from "../../../providers/SwapWidgetProvider"
import { getDepositedBalances } from "../../../services/defuseBalanceService"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import type { ChainType } from "../../../types/deposit"
import { fetchFee } from "../actors/otcMakerConfigLoadActor"
import type { SignMessage } from "../types/sharedTypes"
import { type TradeTerms, deriveTradeTerms } from "../utils/deriveTradeTerms"
import { OtcTakerForm } from "./OtcTakerForm"
import { OtcTakerInvalidOrder } from "./OtcTakerInvalidOrder"

export type OtcTakerWidgetProps = {
  multiPayload: MultiPayload | string

  /** List of available tokens for trading */
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]

  /** User's wallet address */
  userAddress: string | null | undefined
  userChainType: ChainType | null | undefined

  /** Sign message callback */
  signMessage: SignMessage

  /** Theme selection */
  theme?: "dark" | "light"
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
}: OtcTakerWidgetProps) {
  const loading = <div>Loading...</div>

  const { data: protocolFee } = useQuery({
    queryKey: ["protocol_fee"],
    queryFn: fetchFee,
  })

  const tradeTerms = useMemo(() => {
    if (protocolFee == null) {
      return null
    }

    const tradeTerms = deriveTradeTerms(multiPayload, tokenList, protocolFee)

    if (tradeTerms.isErr()) {
      logger.error(tradeTerms.unwrapErr())
    }

    return tradeTerms
  }, [multiPayload, tokenList, protocolFee])

  if (tradeTerms == null) {
    return loading
  }

  return tradeTerms.match({
    ok: (tradeTerms) => (
      <OtcTakerValidationOrder
        tradeTerms={tradeTerms}
        fallback={<div>loading</div>}
      >
        <OtcTakerForm
          tradeTerms={tradeTerms}
          userAddress={userAddress}
          userChainType={userChainType}
          signMessage={signMessage}
        />
      </OtcTakerValidationOrder>
    ),
    err: (error) => <OtcTakerInvalidOrder error={error} />,
  })
}

function OtcTakerValidationOrder({
  tradeTerms,
  fallback,
  children,
}: { tradeTerms: TradeTerms; fallback: ReactNode; children: ReactNode }) {
  let error: string | null = null

  if (new Date(tradeTerms.deadline) < new Date()) {
    error = "TRADE_EXPIRED"
  }

  const { data: makerTokenBalances, isLoading } = useQuery({
    queryKey: [
      "deposited_balance",
      tradeTerms.makerUserId,
      Object.keys(tradeTerms.makerTokenDiff),
    ],
    queryFn: async () => {
      return getDepositedBalances(
        tradeTerms.makerUserId,
        Object.keys(tradeTerms.makerTokenDiff),
        new providers.JsonRpcProvider({
          url: "https://nearrpc.aurora.dev",
        })
      )
    },
    enabled: error == null,
  })

  if (isLoading) {
    return fallback
  }

  if (makerTokenBalances) {
    for (const [tokenId, amount] of Object.entries(tradeTerms.makerTokenDiff)) {
      if (amount >= 0) {
        continue
      }

      const balance = makerTokenBalances[tokenId]

      if (balance == null || balance < -amount) {
        error = "MAKER_INSUFFICIENT_FUNDS"
        break
      }
    }
  }

  if (error != null) {
    return <OtcTakerInvalidOrder error={error} tradeTerms={tradeTerms} />
  }

  return children
}
