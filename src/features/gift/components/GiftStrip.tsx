import { AssetComboIcon } from "../../../components/Asset/AssetComboIcon"
import type {
  BaseTokenInfo,
  TokenValue,
  UnifiedTokenInfo,
} from "../../../types/base"
import { formatTokenValue } from "../../../utils/format"
import { formatGiftDate } from "../utils/formattedDate"

type GiftStripProps = {
  token: BaseTokenInfo | UnifiedTokenInfo
  amount: TokenValue
  updatedAt?: number
}

export function GiftStrip({ token, amount, updatedAt }: GiftStripProps) {
  const formattedDate = updatedAt ? formatGiftDate(updatedAt) : null

  return (
    <div className="flex justify-between items-center gap-2.5">
      <div className="flex items-center relative">
        <AssetComboIcon {...token} />
      </div>
      <div className="flex flex-col">
        <div className="text-sm text-a12 font-bold">
          {formatTokenValue(amount.amount, amount.decimals)} {token.symbol}
        </div>
        {formattedDate && (
          <div className="text-xs text-neutral-11">
            <div className="text-label">{formattedDate}</div>
          </div>
        )}
      </div>
    </div>
  )
}
