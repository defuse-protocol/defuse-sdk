import type { TokenValue } from "../../../types/base"
import { assert } from "../../../utils/assert"
import {
  computeTotalBalanceDifferentDecimals,
  getUnderlyingBaseTokenInfos,
  negateTokenValue,
} from "../../../utils/tokenUtils"
import type { TradeTerms } from "../utils/deriveTradeTerms"
import { SwapStrip } from "./shared/SwapStrip"

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
      <div>Oops!</div>

      <div>
        Looks like this trade is no longer valid — either it expired or the
        funds aren’t there.
      </div>

      <div>Check back with the sender for an update.</div>

      {error != null && <div className="text-red-700">{error}</div>}

      {breakdown != null && tradeTerms != null && (
        <SwapStrip
          tokenIn={tradeTerms.tokenIn}
          tokenOut={tradeTerms.tokenOut}
          amountIn={breakdown.takerSends}
          amountOut={breakdown.takerReceives}
        />
      )}
    </div>
  )
}
