import type { ReactNode } from "react"
import type { BlockchainEnum } from "src/sdk/poaBridge/constants/blockchains"
import type {
  BaseTokenInfo,
  SupportedChainName,
  UnifiedTokenInfo,
} from "src/types/base"
import type { SwappableToken } from "src/types/swap"
import {
  assetNetworkAdapter,
  reverseAssetNetworkAdapter,
} from "src/utils/adapters"
import { isBaseToken, isUnifiedToken } from "src/utils/token"
import { getBlockchainsOptions } from "./blockchainOptions"

export function isAuroraVirtualChain(network: SupportedChainName): boolean {
  const virtualChains = [
    "turbochain",
    "aurora",
    "tuxappchain",
    "vertex",
    "optima",
    "coineasy",
  ]
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

export function availableChainsForToken(
  token: BaseTokenInfo | UnifiedTokenInfo
): Record<string, { label: string; icon: ReactNode; value: string }> {
  const tokens = isUnifiedToken(token) ? token.groupedTokens : [token]
  const chains = tokens.map((token) => token.chainName)

  const options = getBlockchainsOptions()

  const res = Object.values(options)
    .filter((option) =>
      chains.includes(reverseAssetNetworkAdapter[option.value])
    )
    .map((option) => [option.value, option])
  return Object.fromEntries(res)
}

export function getDefaultBlockchainOptionValue(
  token: SwappableToken
): BlockchainEnum | null {
  if (isBaseToken(token)) {
    const key = assetNetworkAdapter[token.chainName]
    return key
      ? (getBlockchainsOptions()[key]?.value as BlockchainEnum | null)
      : null
  }
  return null
}
