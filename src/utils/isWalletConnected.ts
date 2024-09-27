import { CONNECTOR_BTC_MAINNET, CONNECTOR_ETH_BASE } from "src/constants"

import { MapsEnum } from "./maps"
import parseDefuseAsset from "./parseDefuseAsset"

export default function isWalletConnected(id: string): string {
  const to = parseDefuseAsset(id)
  const toNetworkId = `${to?.blockchain}:${to?.network}` as MapsEnum
  const noAccountId = ""

  switch (toNetworkId) {
    case MapsEnum.ETH_BASE:
      const getEthBaseFromLocal = localStorage.getItem(CONNECTOR_ETH_BASE)
      if (!getEthBaseFromLocal) return noAccountId
      return getEthBaseFromLocal
    case MapsEnum.BTC_MAINNET:
      const getBtcMainnetFromLocal = localStorage.getItem(CONNECTOR_BTC_MAINNET)
      if (!getBtcMainnetFromLocal) return noAccountId
      return getBtcMainnetFromLocal
    default:
      return noAccountId
  }
}
