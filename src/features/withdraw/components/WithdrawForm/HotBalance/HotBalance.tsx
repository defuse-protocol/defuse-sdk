import type { FC } from "react"
import type { TokenValueWithPrice } from "../types"
import { adjustTo1kUsd } from "../utils"

interface HotBalanceProps {
  hotBalance?: TokenValueWithPrice | null
}

export const HotBalance: FC<HotBalanceProps> = ({ hotBalance }) => {
  if (!hotBalance) {
    return null
  }

  return (
    <div className="text-gray-11 text-xs font-medium">
      Fast withdrawal: ~${adjustTo1kUsd(hotBalance)}k
    </div>
  )
}
