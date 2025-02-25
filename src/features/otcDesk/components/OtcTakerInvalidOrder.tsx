import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Cross2Icon } from "@radix-ui/react-icons"
import { Callout } from "@radix-ui/themes"
import { AssetComboIcon } from "src/components/Asset/AssetComboIcon"
import { formatTokenValue } from "src/utils/format"
import type { TokenValue } from "../../../types/base"
import { assert } from "../../../utils/assert"
import {
  computeTotalBalanceDifferentDecimals,
  getUnderlyingBaseTokenInfos,
  negateTokenValue,
} from "../../../utils/tokenUtils"
import type { TradeTerms } from "../utils/deriveTradeTerms"

export function OtcTakerInvalidOrder({
  error,
  tradeTerms,
}: {
  error?: string
  tradeTerms?: TradeTerms
}) {
  let amountIn: TokenValue | undefined
  let amountOut: TokenValue | undefined
  let breakdown:
    | {
        takerSends: TokenValue
        takerReceives: TokenValue
      }
    | undefined

  if (tradeTerms != null) {
    amountIn = computeTotalBalanceDifferentDecimals(
      getUnderlyingBaseTokenInfos(tradeTerms.tokenIn),
      tradeTerms.takerTokenDiff,
      { strict: false }
    )

    amountOut = computeTotalBalanceDifferentDecimals(
      getUnderlyingBaseTokenInfos(tradeTerms.tokenOut),
      tradeTerms.takerTokenDiff,
      { strict: false }
    )

    assert(amountIn != null && amountOut != null)

    breakdown = {
      takerSends: negateTokenValue(amountIn),
      takerReceives: amountOut,
    }
  }

  return (
    <div>
      {/* Header Section */}
      <div className="flex flex-row justify-between mb-5">
        <div className="flex flex-col items-start gap-1.5">
          <div className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-2">
            Oops!
          </div>
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Looks like this trade is no longer valid — either it expired or the
            funds aren’t there.
          </div>
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Check back with the sender for an update.
          </div>
        </div>
        <div className="flex justify-center items-start">
          <div className="w-[64px] h-[64px] flex items-center justify-center rounded-full bg-red-300">
            <Cross2Icon className="size-7 text-red-a11" />
          </div>
        </div>
      </div>

      {/* Error Section */}
      {error != null && (
        <Callout.Root size="1" color="red">
          <Callout.Icon>
            <ExclamationTriangleIcon />
          </Callout.Icon>
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}

      {/* Order Section */}
      {tradeTerms != null && breakdown != null && (
        <div className="flex justify-between items-center gap-2 px-4 py-3.5 rounded-lg bg-gray-3 mt-5">
          <div className="flex items-center">
            <div className="flex items-center relative">
              <AssetComboIcon {...tradeTerms.tokenIn} />
              <div className="flex relative items-center -left-[10px] z-10">
                <AssetComboIcon {...tradeTerms.tokenOut} />
              </div>
            </div>
            <div className="text-sm text-a12 font-bold">Swap</div>
          </div>
          <div className="text-xs text-a12">
            {formatTokenValue(
              breakdown.takerSends.amount,
              breakdown.takerSends.decimals
              // biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation>
            )}{" "}
            {tradeTerms.tokenIn.symbol}
            {/* biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation> */}
            {" → "}
            <span className="font-bold">
              {formatTokenValue(
                breakdown.takerReceives.amount,
                breakdown.takerReceives.decimals
                // biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation>
              )}{" "}
              {tradeTerms.tokenOut.symbol}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
