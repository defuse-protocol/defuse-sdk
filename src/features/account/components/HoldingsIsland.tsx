import { Wallet } from "@phosphor-icons/react"
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
    <div className="flex flex-col items-center justify-center py-12">
      <Wallet weight="bold" className="size-8 mb-2.5 text-gray-11" />
      <div className="text-sm font-bold mb-1">No assets here yet</div>
      <div className="text-xs font-medium text-gray-11">
        Deposit funds to start using NEAR Intents
      </div>
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
