import { getTokenId } from "../../../utils/token"
import type { Holding } from "../types/sharedTypes"
import { HoldingItem } from "./shared/HoldingItem"
import { Island } from "./shared/Island"

interface HoldingsIslandProps {
  holdings: Holding[]
}

export function HoldingsIsland({ holdings }: HoldingsIslandProps) {
  return (
    <Island className="py-4">
      {holdings.map((holding) => (
        <HoldingItem key={getTokenId(holding.token)} holding={holding} />
      ))}
    </Island>
  )
}
