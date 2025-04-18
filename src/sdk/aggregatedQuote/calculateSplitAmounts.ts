import type { BaseTokenInfo, TokenValue } from "../../types/base"
import { assert } from "../../utils/assert"
import { adjustDecimals, deduplicateTokens } from "../../utils/tokenUtils"
import { AmountMismatchError } from "./errors/amountMismatchError"

type TokenSlice = BaseTokenInfo
type Balances = Record<string, bigint>

/**
 * First sorting per decimals ascending - Reason: as fewer decimals have coverage problems, it is better to use them first
 * Second sorting per decimals descending - Reason: use less items to cover the split
 */
export function sortForOptimalAmountSplitting(
  uniqueTokensIn: BaseTokenInfo[],
  balances: Balances
): BaseTokenInfo[] {
  return structuredClone(uniqueTokensIn).sort((a, b) => {
    if (b.decimals < a.decimals) {
      return 1
    }
    if (b.decimals > a.decimals) {
      return -1
    }
    const aBalance = balances[a.defuseAssetId]
    const bBalance = balances[b.defuseAssetId]

    assert(aBalance != null)
    assert(bBalance != null)

    const maxDecimalBetweenAandB = Math.max(a.decimals, b.decimals) // taking max from decimals to ave cleaner comparing
    const aBalanceAdjusted = adjustDecimals(
      aBalance,
      a.decimals,
      maxDecimalBetweenAandB
    )
    const bBalanceAdjusted = adjustDecimals(
      bBalance,
      b.decimals,
      maxDecimalBetweenAandB
    )

    if (bBalanceAdjusted < aBalanceAdjusted) {
      return -1
    }

    if (bBalanceAdjusted > aBalanceAdjusted) {
      return 1
    }

    return 0
  })
}

/**
 * Function to calculate how to split the input amounts based on available balances.
 * Duplicate tokens are processed only once and their balances are considered only once.
 */
export function calculateSplitAmounts(
  tokensIn: TokenSlice[],
  amountIn: TokenValue,
  balances: Balances
): Record<string, bigint> {
  const amountsToQuote: Record<string, bigint> = {}

  const uniqueTokensIn_ = deduplicateTokens(tokensIn)
  const uniqueTokensIn = sortForOptimalAmountSplitting(
    uniqueTokensIn_,
    balances
  )

  let remainingAmount = amountIn.amount
  const remainingDecimals = amountIn.decimals

  for (const tokenIn of uniqueTokensIn) {
    const availableIn = balances[tokenIn.defuseAssetId] ?? 0n

    // Convert remaining amount to token's decimals
    const normalizedRemainingAmount = adjustDecimals(
      remainingAmount,
      remainingDecimals,
      tokenIn.decimals
    )

    const amountToQuote = min(availableIn, normalizedRemainingAmount)

    if (amountToQuote > 0n) {
      amountsToQuote[tokenIn.defuseAssetId] = amountToQuote

      // Convert back to original decimals to subtract from remaining
      remainingAmount -= adjustDecimals(
        amountToQuote,
        tokenIn.decimals,
        remainingDecimals
      )
    }

    if (remainingAmount === 0n) break
  }

  if (remainingAmount !== 0n) {
    throw new AmountMismatchError(
      { amount: amountIn.amount, decimals: amountIn.decimals },
      { amount: remainingAmount, decimals: remainingDecimals }
    )
  }

  return amountsToQuote
}

function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}
