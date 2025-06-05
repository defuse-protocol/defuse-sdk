import type { GeneratHLAddressParams } from "src/sdk/hyperunit/types"
import type { BaseTokenInfo } from "src/types"

/**
 * Resolves the correct destination network for token withdrawals from Hyperliquid.
 * Tokens on Hyperliquid must be withdrawn to their native blockchain networks.
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
