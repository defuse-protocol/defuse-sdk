import type { Settings } from "../types"

export let settings: Settings = {
  providerIds: [],
  defuseContractId: "intents.near",
  swapExpirySec: 600, // 10 minutes
  /**
   * Quote query lasts 1.4 seconds in good network conditions
   */
  quoteQueryTimeoutMs: 30000,
  quotePollingIntervalMs: 1000,
  queries: {
    staleTime: 2000 * 60, // 2 minutes
  },
}

export const getSettings = (): Settings => settings

export const setSettings = (newSettings: Partial<Settings>) => {
  settings = { ...settings, ...newSettings }
}
