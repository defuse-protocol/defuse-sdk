import type {
  BaseTokenInfo,
  TokenValue,
  UnifiedTokenInfo,
} from "../../../../types/base"
import { formatTokenValue } from "../../../../utils/format"

type SwapStripProps = {
  tokenIn: BaseTokenInfo | UnifiedTokenInfo
  tokenOut: BaseTokenInfo | UnifiedTokenInfo
  amountIn: TokenValue
  amountOut: TokenValue
}

export function SwapStrip({
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
}: SwapStripProps) {
  return (
    <div>
      <div>Swap</div>
      <div>
        {formatTokenValue(
          amountIn.amount,
          amountIn.decimals
          // biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation>
        )}{" "}
        {tokenIn.symbol}
        {/* biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation> */}
        {" → "}
        {formatTokenValue(
          amountOut.amount,
          amountOut.decimals
          // biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation>
        )}{" "}
        {tokenOut.symbol}
      </div>
    </div>
  )
}
