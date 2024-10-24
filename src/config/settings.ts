import type { Settings } from "../types"
import { BlockchainEnum } from "../types/deposit"

export let settings: Settings = {
  providerIds: [],
  defuseContractId: "defuse-alpha.near",
  swapExpirySec: 600, // 10 minutes
  blockchains: {
    near: {
      name: BlockchainEnum.NEAR,
      icon: "/static/icons/network/near.svg",
    },
    ethereum: {
      name: BlockchainEnum.ETHEREUM,
      icon: "/static/icons/network/ethereum.svg",
    },
    base: {
      name: BlockchainEnum.BASE,
      icon: "/static/icons/network/base.svg",
    },
  },
}

export const getSettings = (): Settings => settings

export const setSettings = (newSettings: Partial<Settings>) => {
  settings = { ...settings, ...newSettings }
}
