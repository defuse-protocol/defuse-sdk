import type { ReactNode } from "react"
import type { SupportedChainName } from "src/types/base"

export function isAuroraVirtualChain(network: SupportedChainName): boolean {
  const virtualChains = ["turbochain", "aurora"]
  return virtualChains.includes(network)
}

export const filterChains = (
  candidates: Record<string, { label: string; icon: ReactNode; value: string }>,
  searchValue: string
) => {
  if (searchValue === "") {
    return candidates
  }

  const lowerCaseSearchValue = searchValue.toLowerCase()

  return Object.fromEntries(
    Object.entries(candidates).filter(
      ([key, chain]) =>
        chain.label.toLowerCase().includes(lowerCaseSearchValue) ||
        chain.value.toLowerCase().includes(lowerCaseSearchValue) ||
        key.toLowerCase().includes(lowerCaseSearchValue)
    )
  )
}
