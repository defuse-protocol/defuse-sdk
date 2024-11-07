import type { Settings } from "../types"

export let settings: Settings = {
  providerIds: [],
  defuseContractId: "intents.near",
  swapExpirySec: 600, // 10 minutes
  /**
   * Quote query lasts 1.4 seconds in good network conditions
   */
  quoteQueryTimeoutMs: 4000,
  quotePollingIntervalMs: 3000,
  /**
   * Minimum deadline for a quote.
   * The server will return quotes with at least this much time remaining.
   */
  quoteMinDeadlineMs: 120_000,
  queries: {
    staleTime: 2000 * 60, // 2 minutes
  },
}

export const getSettings = (): Settings => settings

export const setSettings = (newSettings: Partial<Settings>) => {
  settings = { ...settings, ...newSettings }
}
