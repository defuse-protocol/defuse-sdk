import { useMemo } from "react"
import type { BaseTokenInfo, UnifiedTokenInfo } from "src/types/base"
import {
  availableChainsForToken,
  availableDisabledChainsForToken,
} from "src/utils/blockchain"
import { type NetworkOption, getIntentsOption } from "../constants/blockchains"

export type NetworkOptions = Record<string, NetworkOption>

type UsePreparedNetworkLists = (params: {
  networks: NetworkOptions
  token: BaseTokenInfo | UnifiedTokenInfo | null
  intents?: boolean
}) => {
  availableNetworks: NetworkOptions
  disabledNetworks: NetworkOptions
}

export const usePreparedNetworkLists: UsePreparedNetworkLists = ({
  networks,
  token,
  intents = false,
}) => {
  const availableNetworks = useMemo(
    () =>
      token == null
        ? {}
        : {
            ...(intents ? getIntentsOption() : {}),
            ...availableChainsForToken(token),
          },
    [token, intents]
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
