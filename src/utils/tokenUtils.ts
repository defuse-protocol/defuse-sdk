import type { BalanceMapping } from "../features/machines/depositedBalanceMachine"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../types/base"
import { isBaseToken } from "./token"

export function computeTotalBalance(
  token: BaseTokenInfo | UnifiedTokenInfo,
  balances: BalanceMapping
): bigint | undefined {
  if (isBaseToken(token)) {
    return balances[token.defuseAssetId]
  }

  let total: bigint | undefined

  /** Prevent double counting of the same token */
  const counted = new Set<string>()

  for (const innerToken of token.groupedTokens) {
    if (counted.has(innerToken.defuseAssetId)) {
      continue
    }
    counted.add(innerToken.defuseAssetId)

    const balance = balances[innerToken.defuseAssetId]
    if (balance != null) {
      total = (total ?? 0n) + balance
    }
  }

  return total
}
