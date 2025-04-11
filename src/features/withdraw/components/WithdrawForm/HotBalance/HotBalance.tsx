import type { FC } from "react"
import type { TokenValueWithPrice } from "../types"
import { adjustTo1kUsd } from "../utils"

interface HotBalanceProps {
  hotBalance?: TokenValueWithPrice | null
}

export const HotBalance: FC<HotBalanceProps> = ({ hotBalance }) => {
  const hotBalanceUSD_1k = hotBalance ? adjustTo1kUsd(hotBalance) : null

  return (
    <div className="text-gray-11 text-xs font-medium">
      {hotBalanceUSD_1k ? `Instant: ~$${hotBalanceUSD_1k}k` : "Unlimited"}
    </div>
  )
}
