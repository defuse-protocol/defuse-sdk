import type { SupportedChainName } from "../types"

/**
 * Chain IDs for EVM-compatible chains.
 * Non-EVM chains are `undefined`.
 */
export const CHAIN_IDS: Record<SupportedChainName, number | undefined> = {
  eth: 1,
  near: undefined,
  base: 8453,
  arbitrum: 42161,
  bitcoin: undefined,
  solana: undefined,
  dogecoin: undefined,
  turbochain: 1313161567,
}