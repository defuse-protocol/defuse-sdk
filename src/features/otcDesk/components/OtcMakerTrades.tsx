import {
  Check as CheckIcon,
  Copy as CopyIcon,
  X as TimesIcon,
} from "@phosphor-icons/react"
import { IconButton } from "@radix-ui/themes"
import { useQuery } from "@tanstack/react-query"
import { None, type Option, Some } from "@thames/monads"
import clsx from "clsx"
import { providers } from "near-api-js"
import type { CodeResult } from "near-api-js/lib/providers/provider"
import type { ReactElement } from "react"
import * as v from "valibot"
import { AssetComboIcon } from "../../../components/Asset/AssetComboIcon"
import { Copy } from "../../../components/IntentCard/CopyButton"
import { settings } from "../../../config/settings"
import { getDepositedBalances } from "../../../services/defuseBalanceService"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import { assert } from "../../../utils/assert"
import { formatTokenValue } from "../../../utils/format"
import { computeTotalBalanceDifferentDecimals } from "../../../utils/tokenUtils"
import { useOtcMakerTrades } from "../stores/otcMakerTrades"
import { type TradeTerms, deriveTradeTerms } from "../utils/deriveTradeTerms"

interface OtcMakerTradesProps {
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
  generateLink: (multiPayload: MultiPayload) => string
}

export function OtcMakerTrades({
  tokenList,
  generateLink,
}: OtcMakerTradesProps) {
  const trades = useOtcMakerTrades((s) => s.trades)

  if (trades.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-3 px-5 pb-5">
      <div className="font-bold text-label text-sm">Pending orders</div>

      <div className="flex flex-col gap-2.5">
        {trades.map((trade) => (
          <OtcMakerTradeItem
            key={trade.tradeId}
            tradeId={trade.tradeId}
            multiPayload={trade.makerMultiPayload}
            updatedAt={trade.updatedAt}
            tokenList={tokenList}
            generateLink={generateLink}
          />
        ))}
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
}

function OtcMakerTradeItem({
  multiPayload,
  tokenList,
  generateLink,
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

  return (
    <div>
      <div
        className={clsx(
          "px-4 py-2.5 gap-2.5 flex items-center",
          err.isNone()
            ? "rounded-lg bg-gray-3"
            : "rounded-tl-lg rounded-tr-lg bg-red-3"
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
          <div className="font-bold text-label text-sm">Swap</div>
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

          <IconButton
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(generateLink(multiPayload))
            }}
            variant="outline"
            color={err.isNone() ? "gray" : "red"}
            className="rounded-lg"
          >
            <TimesIcon weight="bold" />
          </IconButton>
        </div>
      </div>

      {err
        .map((err): ReactElement | null => {
          return (
            // biome-ignore lint/correctness/useJsxKeyInIterable: it's not iterating over an array
            <div className="rounded-br-lg rounded-bl-lg bg-red-9 text-white px-4 py-2 text-xs font-medium">
              {err === "ORDER_EXPIRED" && <div>The order is expired</div>}

              {err === "NONCE_ALREADY_USED" && (
                <div>The order has been cancelled or already filled</div>
              )}

              {err === "MAKER_INSUFFICIENT_FUNDS" && (
                <div>
                  {/* biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation> */}
                  <span className="font-bold">Something went wrong.</span>{" "}
                  Please cancel the order and create another one.
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
