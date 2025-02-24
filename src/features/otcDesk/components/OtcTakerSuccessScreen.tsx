import { assert } from "../../../utils/assert"
import {
  computeTotalBalanceDifferentDecimals,
  getUnderlyingBaseTokenInfos,
  negateTokenValue,
} from "../../../utils/tokenUtils"
import type { TradeTerms } from "../utils/deriveTradeTerms"
import { SwapStrip } from "./shared/SwapStrip"

const NEAR_EXPLORER = "https://nearblocks.io"

export function OtcTakerSuccessScreen({
  tradeTerms,
  intentHashes,
  txHash,
}: {
  tradeTerms: TradeTerms
  intentHashes: string[]
  txHash: string
}) {
  const amountIn = computeTotalBalanceDifferentDecimals(
    getUnderlyingBaseTokenInfos(tradeTerms.tokenIn),
    tradeTerms.takerTokenDiff,
    { strict: false }
  )

  const amountOut = computeTotalBalanceDifferentDecimals(
    getUnderlyingBaseTokenInfos(tradeTerms.tokenOut),
    tradeTerms.takerTokenDiff,
    { strict: false }
  )

  assert(amountIn != null && amountOut != null)

  const breakdown = {
    takerSends: negateTokenValue(amountIn),
    takerReceives: amountOut,
  }

  const txUrl = `${NEAR_EXPLORER}/txns/${txHash}`

  return (
    <div>
      <div>All done!</div>

      <div>
        Your swap has been successfully completed, and the funds are now
        available in your account.
      </div>

      <SwapStrip
        tokenIn={tradeTerms.tokenIn}
        tokenOut={tradeTerms.tokenOut}
        amountIn={breakdown.takerSends}
        amountOut={breakdown.takerReceives}
      />

      <div>
        <div>Intents</div>
        <div>
          {intentHashes.map((intentHash) => (
            <div key={intentHash}>{intentHash}</div>
          ))}
        </div>
      </div>
      <div>
        <div>Transaction hash</div>
        <div>
          <a href={txUrl} rel="noopener noreferrer">
            {txHash}
          </a>
        </div>
      </div>
    </div>
  )
}
