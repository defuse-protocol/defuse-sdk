import type { GeneratHLAddressParams } from "src/sdk/hyperunit/types"
import type { BaseTokenInfo } from "src/types"

/**
 * Resolves the correct destination network for token withdrawals from Hyperliquid.
 *
 * This function handles the special case where tokens on Hyperliquid need to be
 * withdrawn to their native networks.
 *
 * Example:
 * - Bitcoin (BTC) tokens must be withdrawn to the Bitcoin network
 * - Solana (SOL) tokens must be withdrawn to the Solana network
 * - USDC tokens must be withdrawn to Arbitrum
 */
export function getHyperliquidSrcChain(
  tokenIn: BaseTokenInfo
): GeneratHLAddressParams["srcChain"] {
  const symbol = tokenIn.symbol
  switch (symbol) {
    case "BTC":
      return "bitcoin"
    case "SOL":
      return "solana"
    case "USDC":
      return "ethereum"
    default:
      throw new Error("Error getting src chain for Hyperliquid")
  }
}

export function getHyperliquidAsset(
  token: BaseTokenInfo
): GeneratHLAddressParams["asset"] {
  switch (token.symbol) {
    case "BTC":
      return "btc"
    case "SOL":
      return "sol"
    case "USDC":
      return "usdc"
    default:
      throw new Error("Error getting asset for Hyperliquid")
  }
}
