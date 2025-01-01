import type { BalanceMapping } from "../features/machines/depositedBalanceMachine"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../types/base"
import { isBaseToken } from "./token"

export function computeTotalBalance(
  token: BaseTokenInfo["defuseAssetId"][] | BaseTokenInfo | UnifiedTokenInfo,
  balances: BalanceMapping
): bigint | undefined {
  // Case 1: Array of token IDs
  if (Array.isArray(token)) {
    const uniqueTokens = new Set(token)
    let total = 0n

    for (const tokenId of uniqueTokens) {
      const balance = balances[tokenId]
      if (balance == null) {
        return undefined
      }
      total += balance
    }

    return total
  }

  // Case 2: Base token
  if (isBaseToken(token)) {
    return balances[token.defuseAssetId]
  }

  // Case 3: Unified token
  return computeTotalBalance(
    token.groupedTokens.map((t) => t.defuseAssetId),
    balances
  )
}

export function getDerivedToken(
  tokenIn: BaseTokenInfo | UnifiedTokenInfo,
  chainName: string | null
): BaseTokenInfo | null {
  if (isBaseToken(tokenIn)) {
    return chainName === tokenIn.chainName ? tokenIn : null
  }

  if (chainName != null) {
    const tokenOut = tokenIn.groupedTokens.find(
      (token) => token.chainName === chainName
    )
    if (tokenOut != null) {
      return tokenOut
    }
  }

  return null
}
