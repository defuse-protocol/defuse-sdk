import { getTokenId } from "../../../utils/token"
import type { Holding } from "../types/sharedTypes"
import { HoldingItem, HoldingItemSkeleton } from "./shared/HoldingItem"
import { Island } from "./shared/Island"

interface HoldingsIslandProps {
  holdings: Holding[] | undefined
}

export function HoldingsIsland({ holdings }: HoldingsIslandProps) {
  return (
    <Island className="py-4">
      <Content holdings={holdings} />
    </Island>
  )
}

function Content({ holdings }: { holdings: Holding[] | undefined }) {
  if (holdings == null) {
    return <LoadingScreen />
  }

  if (holdings.length === 0) {
    return <EmptyScreen />
  }

  return holdings.map((holding) => (
    <HoldingItem key={getTokenId(holding.token)} holding={holding} />
  ))
}

function EmptyScreen() {
  return (
    <div className="text-gray-11 text-sm h-7 flex items-center justify-center">
      Your assets will appear here once you deposit them
    </div>
  )
}

function LoadingScreen() {
  return (
    <>
      <HoldingItemSkeleton />
      <HoldingItemSkeleton />
      <HoldingItemSkeleton />
    </>
  )
}
