import {
  Check as CheckIcon,
  Copy as CopyIcon,
  X as TimesIcon,
} from "@phosphor-icons/react"
import { Button, IconButton } from "@radix-ui/themes"
import { useQuery } from "@tanstack/react-query"
import { Err, None, Ok, type Option, type Result, Some } from "@thames/monads"
import { useSelector } from "@xstate/react"
import clsx from "clsx"
import { providers } from "near-api-js"
import type { CodeResult } from "near-api-js/lib/providers/provider"
import {
  type ReactElement,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react"
import * as v from "valibot"
import { type ActorRefFrom, createActor, toPromise } from "xstate"
import { AssetComboIcon } from "../../../components/Asset/AssetComboIcon"
import { Copy } from "../../../components/IntentCard/CopyButton"
import { settings } from "../../../config/settings"
import type { SignerCredentials } from "../../../core/formatters"
import { getDepositedBalances } from "../../../services/defuseBalanceService"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import { assert } from "../../../utils/assert"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import { formatTokenValue } from "../../../utils/format"
import { computeTotalBalanceDifferentDecimals } from "../../../utils/tokenUtils"
import type { SendNearTransaction } from "../../machines/publicKeyVerifierMachine"
import type { signIntentMachine } from "../../machines/signIntentMachine"
import { usePublicKeyModalOpener } from "../../swap/hooks/usePublicKeyModalOpener"
import {
  type OTCMakerOrderCancellationActorOutput,
  otcMakerOrderCancellationActor,
} from "../actors/otcMakerOrderCancellationActor"
import { useCountdownTimer } from "../hooks/useCountdownTimer"
import {
  otcMakerTradesStore,
  useOtcMakerTrades,
} from "../stores/otcMakerTrades"
import type { SignMessage } from "../types/sharedTypes"
import { type TradeTerms, deriveTradeTerms } from "../utils/deriveTradeTerms"
import { CancellationDialog } from "./shared/CancellationDialog"

interface OtcMakerTradesProps {
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
  generateLink: (multiPayload: MultiPayload) => string
  signerCredentials: SignerCredentials
  signMessage: SignMessage
  sendNearTransaction: SendNearTransaction
}

export function OtcMakerTrades({
  tokenList,
  generateLink,
  signerCredentials,
  signMessage,
  sendNearTransaction,
}: OtcMakerTradesProps) {
  const trades = useOtcMakerTrades((s) => {
    const userId = userAddressToDefuseUserId(
      signerCredentials.credential,
      signerCredentials.credentialType
    )
    return s.trades[userId] ?? []
  })

  if (trades.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-3 px-5 pb-5">
      <div className="font-bold text-label text-sm">Pending orders</div>

      <div className="flex flex-col gap-2.5">
        <OtcMakerOrderCancellationProvider
          signerCredentials={signerCredentials}
          signMessage={signMessage}
          sendNearTransaction={sendNearTransaction}
        >
          {trades.map((trade) => (
            <OtcMakerTradeItem
              key={trade.tradeId}
              tradeId={trade.tradeId}
              multiPayload={trade.makerMultiPayload}
              updatedAt={trade.updatedAt}
              tokenList={tokenList}
              generateLink={generateLink}
              signerCredentials={signerCredentials}
            />
          ))}
        </OtcMakerOrderCancellationProvider>
      </div>
    </div>
  )
}

interface OtcMakerTradeItemProps {
  tradeId: string
  multiPayload: MultiPayload
  updatedAt: number
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
  generateLink: (multiPayload: MultiPayload) => string
  signerCredentials: SignerCredentials
}

function OtcMakerTradeItem({
  tradeId,
  multiPayload,
  tokenList,
  generateLink,
  signerCredentials,
}: OtcMakerTradeItemProps) {
  const tradeTermsResult = deriveTradeTerms(multiPayload, tokenList, 0)

  if (tradeTermsResult.isErr()) {
    return <div>Error: {tradeTermsResult.unwrapErr()}</div>
  }

  const tradeTerms = tradeTermsResult.unwrap()

  // Need to flip tokens, because `deriveTradeTerms` computes the taker side
  const { tokenIn: tokenOut, tokenOut: tokenIn } = tradeTerms

  const totalAmountIn = computeTotalBalanceDifferentDecimals(
    tokenIn,
    tradeTerms.makerTokenDiff,
    { strict: false }
  )
  assert(totalAmountIn)

  const totalAmountOut = computeTotalBalanceDifferentDecimals(
    tokenOut,
    tradeTerms.makerTokenDiff,
    { strict: false }
  )
  assert(totalAmountOut)

  const err = useValidateTrade(tradeTerms)
  const errIsCritical = err
    .map((e) => e === "MAKER_INSUFFICIENT_FUNDS")
    .unwrapOr(false)
  const errIsSoft = err
    .map((e) => e !== "MAKER_INSUFFICIENT_FUNDS")
    .unwrapOr(false)

  const { cancelOrder } = useContext(OtcMakerOrderCancellationContext)
  const timeLeft = useCountdownTimer({ deadline: tradeTerms.deadline })

  return (
    <div>
      <div
        className={clsx(
          "px-4 py-2.5 gap-2.5 flex items-center",
          !errIsCritical ? "bg-gray-3" : "bg-red-3",
          err.isNone() ? "rounded-lg" : "rounded-tl-lg rounded-tr-lg"
        )}
      >
        <div className="flex items-center">
          <AssetComboIcon
            {...tokenIn}
            style={{
              mask: "radial-gradient(18px at 34px 50%, transparent 99%, rgb(255, 255, 255) 100%)",
            }}
          />
          <AssetComboIcon {...tokenOut} className="-ml-2.5" />
        </div>

        <div className="flex flex-col gap-1 flex-1">
          <div className="font-bold text-label text-sm flex items-center gap-2">
            Swap
            <span className="text-xs font-medium text-gray-11">{timeLeft}</span>
          </div>
          <div className="font-medium text-xs text-gray-11">
            {formatTokenValue(-totalAmountIn.amount, totalAmountIn.decimals, {
              fractionDigits: 4,
              // biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation>
            })}{" "}
            {/* biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation> */}
            {tokenIn.symbol} →{" "}
            <span className="font-bold text-gray-12">
              {formatTokenValue(
                totalAmountOut.amount,
                totalAmountOut.decimals,
                {
                  fractionDigits: 4,
                }
                // biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation>
              )}{" "}
              {tokenOut.symbol}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {err.isNone() && (
            <Copy text={() => generateLink(multiPayload)}>
              {(copied) => (
                <IconButton
                  type="button"
                  variant="outline"
                  color="gray"
                  className="rounded-lg"
                >
                  {copied ? (
                    <CheckIcon weight="bold" />
                  ) : (
                    <CopyIcon weight="bold" />
                  )}
                </IconButton>
              )}
            </Copy>
          )}

          {errIsSoft ? (
            <Button
              type="button"
              onClick={() => {
                otcMakerTradesStore
                  .getState()
                  .removeTrade(tradeId, signerCredentials)
              }}
              variant="outline"
              color="gray"
              size="1"
              className="rounded-lg"
            >
              Remove
            </Button>
          ) : (
            <IconButton
              type="button"
              onClick={() => {
                cancelOrder({
                  nonceBas64: tradeTerms.makerNonceBase64,
                  tradeId,
                })
              }}
              variant="outline"
              color="red"
              className="rounded-lg"
            >
              <TimesIcon weight="bold" />
            </IconButton>
          )}
        </div>
      </div>

      {err
        .map((err): ReactElement | null => {
          return (
            // biome-ignore lint/correctness/useJsxKeyInIterable: it's not iterating over an array
            <div
              className={clsx(
                "rounded-br-lg rounded-bl-lg px-4 py-2 text-xs font-medium",
                !errIsCritical ? "bg-gray-6" : "bg-red-9 text-white"
              )}
            >
              {err === "ORDER_EXPIRED" && <div>The order is expired</div>}

              {err === "NONCE_ALREADY_USED" && (
                <div>The order has been cancelled or already filled</div>
              )}

              {err === "MAKER_INSUFFICIENT_FUNDS" && (
                <div>
                  {/* biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation> */}
                  <span className="font-bold">The order cannot be filled.</span>{" "}
                  Your balance is incorrect. Please cancel the order and new
                  another one.
                </div>
              )}
            </div>
          )
        })
        .unwrapOr(null)}
    </div>
  )
}

function useValidateTrade(tradeTerms: TradeTerms) {
  let error: Option<
    "ORDER_EXPIRED" | "NONCE_ALREADY_USED" | "MAKER_INSUFFICIENT_FUNDS"
  > = None

  if (new Date(tradeTerms.deadline) < new Date()) {
    error = Some("ORDER_EXPIRED")
  }

  const makerBalanceValidation = useQuery({
    enabled: error.isNone(),
    queryKey: [
      "deposited_balance",
      tradeTerms.makerUserId,
      Object.keys(tradeTerms.makerTokenDiff),
    ],
    queryFn: () => {
      return getDepositedBalances(
        tradeTerms.makerUserId,
        Object.keys(tradeTerms.makerTokenDiff),
        new providers.JsonRpcProvider({
          url: "https://nearrpc.aurora.dev",
        })
      )
    },
    select: (makerTokenBalances): Option<"MAKER_INSUFFICIENT_FUNDS"> => {
      for (const [tokenId, amount] of Object.entries(
        tradeTerms.makerTokenDiff
      )) {
        if (amount >= 0) {
          continue
        }

        const balance = makerTokenBalances[tokenId]

        if (balance == null || balance < -amount) {
          return Some("MAKER_INSUFFICIENT_FUNDS")
        }
      }
      return None
    },
  })

  const nonceValidation = useQuery({
    enabled: error.isNone(),
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
        account_id: settings.defuseContractId,
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
    select: (nonceIsUsed): Option<"NONCE_ALREADY_USED"> => {
      return nonceIsUsed ? Some("NONCE_ALREADY_USED") : None
    },
  })

  error = error
    .or(makerBalanceValidation.data ?? error)
    .or(nonceValidation.data ?? error)

  return error
}

const OtcMakerOrderCancellationContext = createContext<{
  cancelOrder: (arg: { nonceBas64: string; tradeId: string }) => Promise<
    Result<
      OTCMakerOrderCancellationActorOutput,
      { reason: "CANCELLATION_IN_PROGRESS" }
    >
  >
}>({
  cancelOrder: async () => {
    throw new Error("not implemented")
  },
})

function OtcMakerOrderCancellationProvider({
  children,
  signerCredentials,
  signMessage,
  sendNearTransaction,
}: {
  children: ReactNode
  signerCredentials: SignerCredentials
  signMessage: SignMessage
  sendNearTransaction: SendNearTransaction
}) {
  const [actorRef, setActorRef] = useState<ActorRefFrom<
    typeof otcMakerOrderCancellationActor
  > | null>(null)

  useEffect(() => {
    return () => {
      if (actorRef) {
        actorRef.stop()
      }
    }
  }, [actorRef])

  const clearActorRef = () => {
    setActorRef(null)
  }

  const cancelOrder = async (arg: {
    nonceBas64: string
    tradeId: string
  }): Promise<
    Result<
      OTCMakerOrderCancellationActorOutput,
      { reason: "CANCELLATION_IN_PROGRESS" }
    >
  > => {
    if (actorRef) {
      return Err({
        reason: "CANCELLATION_IN_PROGRESS",
      })
    }

    const actor = createActor(otcMakerOrderCancellationActor, {
      input: {
        nonceBas64: arg.nonceBas64,
        tradeId: arg.tradeId,
        signerCredentials,
      },
    })

    setActorRef(actor)

    actor.start()

    return toPromise(actor).then(Ok).finally(clearActorRef)
  }

  const publicKeyVerifierRef = useSelector(
    useSelector(
      actorRef ?? undefined,
      (state) =>
        state?.children.signRef as
          | undefined
          | ActorRefFrom<typeof signIntentMachine>
    ),
    (state) => {
      if (state) {
        return state.children.publicKeyVerifierRef
      }
    }
  )

  // @ts-expect-error ???
  usePublicKeyModalOpener(publicKeyVerifierRef, sendNearTransaction)

  return (
    <OtcMakerOrderCancellationContext.Provider value={{ cancelOrder }}>
      {children}

      {actorRef != null && (
        <CancellationDialog
          actorRef={actorRef}
          signerCredentials={signerCredentials}
          signMessage={signMessage}
        />
      )}
    </OtcMakerOrderCancellationContext.Provider>
  )
}
