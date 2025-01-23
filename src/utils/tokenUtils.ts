import type { BalanceMapping } from "../features/machines/depositedBalanceMachine"
import type { BaseTokenInfo, TokenValue, UnifiedTokenInfo } from "../types/base"
import { assert } from "./assert"
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

export class DuplicateTokenError extends Error {
  constructor(tokenId: string, decimals1: number, decimals2: number) {
    super(
      `Duplicate token ${tokenId} found with different decimals: ${decimals1} and ${decimals2}`
    )
    this.name = "DuplicateTokenError"
  }
}

export function adjustDecimals(
  amount: bigint,
  fromDecimals: number,
  toDecimals: number
): bigint {
  if (fromDecimals === toDecimals) return amount
  if (fromDecimals > toDecimals) {
    return amount / BigInt(10 ** (fromDecimals - toDecimals))
  }
  return amount * BigInt(10 ** (toDecimals - fromDecimals))
}

export function deduplicateTokens(tokens: BaseTokenInfo[]): BaseTokenInfo[] {
  const tokenMap = new Map<string, BaseTokenInfo>()

  for (const token of tokens) {
    const existing = tokenMap.get(token.defuseAssetId)
    if (existing) {
      if (existing.decimals !== token.decimals) {
        throw new DuplicateTokenError(
          token.defuseAssetId,
          existing.decimals,
          token.decimals
        )
      }
      // If decimals match, keep existing token
      continue
    }
    tokenMap.set(token.defuseAssetId, token)
  }

  return Array.from(tokenMap.values())
}

/**
 * @param token - The token or array of tokens to compute the balance for.
 * @param balances - The mapping of token balances.
 * @param config - Configuration options.
 * @param config.strict - Ensures all tokens have a balance if `true`, otherwise returns `undefined`.
 */
export function computeTotalBalanceDifferentDecimals(
  token: BaseTokenInfo[] | BaseTokenInfo | UnifiedTokenInfo,
  balances: BalanceMapping,
  config: { strict: boolean } = { strict: true }
): TokenValue | undefined {
  // Case 1: Base token
  if (!Array.isArray(token) && isBaseToken(token)) {
    // biome-ignore lint/style/noParameterAssign: This is a valid use case
    token = [token]
  }

  // Case 2: Unified token
  const uniqueTokens = deduplicateTokens(
    Array.isArray(token) ? token : token.groupedTokens
  )

  if (uniqueTokens.length === 0) {
    return { amount: 0n, decimals: 0 }
  }

  const maxDecimals = Math.max(...uniqueTokens.map((t) => t.decimals))
  let total = null

  for (const t of uniqueTokens) {
    const balance = balances[t.defuseAssetId]
    if (balance == null) {
      if (config.strict) {
        return undefined
      }
      continue
    }

    total ??= 0n
    total += adjustDecimals(balance, t.decimals, maxDecimals)
  }

  if (total == null) {
    return undefined
  }

  return { amount: total, decimals: maxDecimals }
}

/**
 * Convert a unified token to a base token, by getting the first token in the group.
 * It should be used when you need to get *ANY* single token from a unified token.
 */
export function getAnyBaseTokenInfo(
  token: BaseTokenInfo | UnifiedTokenInfo
): BaseTokenInfo {
  const t = isBaseToken(token) ? token : token.groupedTokens[0]
  assert(t != null, "Token is undefined")
  return t
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

export function compareAmounts(
  value1: TokenValue,
  value2: TokenValue
): -1 | 0 | 1 {
  const maxDecimals = Math.max(value1.decimals, value2.decimals)
  const normalizedAmount1 = adjustDecimals(
    value1.amount,
    value1.decimals,
    maxDecimals
  )
  const normalizedAmount2 = adjustDecimals(
    value2.amount,
    value2.decimals,
    maxDecimals
  )

  if (normalizedAmount1 < normalizedAmount2) return -1
  if (normalizedAmount1 > normalizedAmount2) return 1
  return 0
}

export function minAmounts(value1: TokenValue, value2: TokenValue): TokenValue {
  return compareAmounts(value1, value2) <= 0 ? value1 : value2
}

export function subtractAmounts(
  value1: TokenValue,
  token2: TokenValue
): TokenValue {
  const maxDecimals = Math.max(value1.decimals, token2.decimals)
  const normalizedAmount1 = adjustDecimals(
    value1.amount,
    value1.decimals,
    maxDecimals
  )
  const normalizedAmount2 = adjustDecimals(
    token2.amount,
    token2.decimals,
    maxDecimals
  )

  return {
    amount: normalizedAmount1 - normalizedAmount2,
    decimals: maxDecimals,
  }
}

export function adjustDecimalsTokenValue(
  value: TokenValue,
  toDecimals: number
): TokenValue {
  return {
    amount: adjustDecimals(value.amount, value.decimals, toDecimals),
    decimals: toDecimals,
  }
}

export function truncateTokenValue(
  value: TokenValue,
  decimals: number
): TokenValue {
  return adjustDecimalsTokenValue(
    adjustDecimalsTokenValue(value, decimals),
    value.decimals
  )
}
