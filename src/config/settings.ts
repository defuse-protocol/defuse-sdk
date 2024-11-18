import type { RpcUrl } from "src/utils/defuse"
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
  /**
   * Max value of minimum deadline for a quote.
   * The server will return quotes with at least this much time remaining.
   */
  maxQuoteMinDeadlineMs: 600_000,
  queries: {
    staleTime: 2000 * 60, // 2 minutes
  },
  /**
   * RPC URLs for different blockchains.
   * Ensure these URLs are valid and accessible.
   */
  rpcUrls: {
    near: "https://nearrpc.aurora.dev" as RpcUrl,
    ethereum: "https://cloudflare-eth.com" as RpcUrl,
    base: "https://mainnet.base.org" as RpcUrl,
    arbitrum: "https://arb1.arbitrum.io/rpc" as RpcUrl,
    bitcoin: "https://mainnet.bitcoin.org" as RpcUrl,
    solana: "https://api.mainnet-beta.solana.com" as RpcUrl,
  },
}

export const getSettings = (): Settings => settings

export const setSettings = (newSettings: Partial<Settings>) => {
  settings = { ...settings, ...newSettings }
}
