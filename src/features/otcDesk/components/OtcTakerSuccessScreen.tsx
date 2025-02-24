import { useQuery } from "@tanstack/react-query"
import { waitForIntentSettlement } from "../../../services/intentService"
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
}: {
  tradeTerms: TradeTerms
  intentHashes: string[]
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

  const intentStatus = useQuery({
    queryKey: ["intents_status", intentHashes],
    queryFn: async ({ signal }) => {
      const intentHash = intentHashes[0]
      assert(intentHash != null)
      return waitForIntentSettlement(signal, intentHash)
    },
  })

  const txUrl =
    intentStatus.data?.txHash != null
      ? `${NEAR_EXPLORER}/txns/${intentStatus.data.txHash}`
      : null

  return (
    <div>
      <div>{intentStatus.isPending ? "Almost there" : "All done!"}</div>

      {intentStatus.isPending ? (
        <div>
          Your swap is being processed. You will receive your funds shortly.
        </div>
      ) : (
        <div>
          Your swap has been successfully completed, and the funds are now
          available in your account.
        </div>
      )}

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
      {txUrl != null && (
        <div>
          <div>Transaction hash</div>
          <div>
            <a href={txUrl} rel="noopener noreferrer" target="_blank">
              {intentStatus.data?.txHash}
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
