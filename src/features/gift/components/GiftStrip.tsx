import { AssetComboIcon } from "../../../components/Asset/AssetComboIcon"
import type {
  BaseTokenInfo,
  TokenValue,
  UnifiedTokenInfo,
} from "../../../types/base"
import { formatTokenValue } from "../../../utils/format"

type SwapStripProps = {
  tokenIn: BaseTokenInfo | UnifiedTokenInfo
  amountIn: TokenValue
}

export function GiftStrip({ tokenIn, amountIn }: SwapStripProps) {
  return (
    <div className="flex justify-between items-center gap-2.5">
      <div className="flex items-center relative">
        <AssetComboIcon {...tokenIn} />
      </div>
      <div className="text-sm text-a12 font-bold">
        {formatTokenValue(amountIn.amount, amountIn.decimals)} {tokenIn.symbol}
      </div>
    </div>
  )
}
