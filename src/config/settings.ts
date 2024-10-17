import type { Settings } from "../types"

export let settings: Settings = {
  providerIds: [],
  defuseContractId: "defuse.near",
  swapExpirySec: 600, // 10 minutes
}

export const getSettings = (): Settings => settings

export const setSettings = (newSettings: Partial<Settings>) => {
  settings = { ...settings, ...newSettings }
}
