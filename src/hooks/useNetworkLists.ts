import { type ReactNode, useMemo } from "react"
import type { BaseTokenInfo, UnifiedTokenInfo } from "src/types/base"
import {
  availableChainsForToken,
  availableDisabledChainsForToken,
} from "src/utils/blockchain"

export type NetworkOptions = Record<
  string,
  {
    label: string
    icon: ReactNode
    value: string
  }
>

type UsePreparedNetworkLists = (
  networks: NetworkOptions,
  token: BaseTokenInfo | UnifiedTokenInfo | null
) => {
  availableNetworks: NetworkOptions
  disabledNetworks: NetworkOptions
}

export const usePreparedNetworkLists: UsePreparedNetworkLists = (
  networks,
  token
) => {
  const availableNetworks = useMemo(
    () => (token == null ? {} : availableChainsForToken(token)),
    [token]
  )
  const disabledNetworks = useMemo(
    () =>
      token == null
        ? {}
        : availableDisabledChainsForToken(networks, availableNetworks),
    [networks, availableNetworks, token]
  )
  return {
    availableNetworks,
    disabledNetworks,
  }
}
