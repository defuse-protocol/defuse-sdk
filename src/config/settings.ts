import type { SupportedChainName } from "../types/base"

interface Settings {
  defuseContractId: string
  swapExpirySec: number
  quoteQueryTimeoutMs: number
  quotePollingIntervalMs: number
  quoteMinDeadlineMs: number
  maxQuoteMinDeadlineMs: number
  queries: {
    staleTime: number
  }
  rpcUrls: {
    [key in SupportedChainName]: string
  }
}

export const settings: Settings = {
  defuseContractId: "intents.near",
  swapExpirySec: 600, // 10 minutes
  /**
   * Quote query lasts 1.4 seconds in good network conditions.
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
    near: "https://nearrpc.aurora.dev",
    eth: "https://eth.drpc.org",
    base: "https://mainnet.base.org",
    arbitrum: "https://arb1.arbitrum.io/rpc",
    bitcoin: "https://mainnet.bitcoin.org",
    solana:
      "https://quiet-solemn-asphalt.solana-mainnet.quiknode.pro/91aa5918df65520d47a54d88590f1503a4e804b1",
    dogecoin: "https://go.getblock.io/5f7f5fba970e4f7a907fcd2c5f4c38a2",
    turbochain: "https://rpc-0x4e45415f.aurora-cloud.dev",
    aurora: "https://mainnet.aurora.dev",
    xrpledger: "https://xrplcluster.com",
  },
}
