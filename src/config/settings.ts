import type { Settings } from "../types"

export let settings: Settings = {
  providerIds: [],
  defuseContractId: "defuse-alpha.near",
  swapExpirySec: 600, // 10 minutes
  queries: {
    staleTime: 2000 * 60, // 2 minutes
  },
}

export const getSettings = (): Settings => settings

export const setSettings = (newSettings: Partial<Settings>) => {
  settings = { ...settings, ...newSettings }
}
