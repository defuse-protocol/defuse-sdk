import { grossUpAmount, netDownAmount } from "../../../utils/tokenUtils"

export interface TokenBalances {
  [token: string]: bigint
}

interface FillStep {
  fromToken: string
  toToken: string
  fromAmount: bigint
  toAmount: bigint
  fee: bigint
}

export interface FillResult {
  remainingBalances: TokenBalances
  steps: FillStep[]
  success: boolean
}

// Find best sources combining multiple tokens if necessary
function findOptimalTokenSources(
  remainingBalances: TokenBalances,
  requiredAmount: bigint,
  targetToken: string,
  feeBasisPoints: bigint
): { steps: FillStep[]; success: boolean } {
  const sourceAmount = grossUpAmount(requiredAmount, Number(feeBasisPoints))

  // Try to find a single token first
  for (const [token, balance] of Object.entries(remainingBalances)) {
    if (token !== targetToken && balance >= sourceAmount) {
      // We found a single token with sufficient balance
      const received = netDownAmount(sourceAmount, Number(feeBasisPoints))

      return {
        steps: [
          {
            fromToken: token,
            toToken: targetToken,
            fromAmount: sourceAmount,
            toAmount: received,
            fee: sourceAmount - received,
          },
        ],
        success: true,
      }
    }
  }

  // If no single token is sufficient, try combining tokens
  // Sort tokens by balance (descending) to use larger balances first
  const sortedTokens = Object.entries(remainingBalances)
    .filter(([token]) => token !== targetToken)
    .sort(([, a], [, b]) => (b > a ? -1 : b < a ? 1 : 0))

  if (sortedTokens.length === 0) {
    return { steps: [], success: false }
  }

  // Calculate total available balance across all tokens
  const totalAvailable = sortedTokens.reduce(
    (sum, [, balance]) => sum + balance,
    0n
  )

  // If total available is insufficient, we can't satisfy the requirement
  if (totalAvailable < sourceAmount) {
    return { steps: [], success: false }
  }

  // We have enough in total, so use tokens in descending order of balance
  let remainingNeeded = sourceAmount
  const steps: FillStep[] = []

  for (const [token, balance] of sortedTokens) {
    if (remainingNeeded <= 0n) break

    const amountToUse = balance >= remainingNeeded ? remainingNeeded : balance
    remainingNeeded -= amountToUse

    if (amountToUse > 0n) {
      const received = netDownAmount(amountToUse, Number(feeBasisPoints))

      steps.push({
        fromToken: token,
        toToken: targetToken,
        fromAmount: amountToUse,
        toAmount: received,
        fee: amountToUse - received,
      })
    }
  }

  return {
    steps,
    success: true,
  }
}

export function fillWithMinimalExchanges(
  balances: TokenBalances,
  required: TokenBalances,
  feeBasisPoints: bigint
): FillResult {
  const result: FillResult = {
    remainingBalances: { ...balances },
    steps: [],
    success: true,
  }

  // Sort required tokens by amount descending to handle larger amounts first
  const sortedRequired = Object.entries(required).sort(([, a], [, b]) =>
    b > a ? 1 : b < a ? -1 : 0
  )

  // First pass: Use direct balances where possible
  for (const [token, requiredAmount] of sortedRequired) {
    const availableAmount = result.remainingBalances[token] ?? 0n

    if (availableAmount >= requiredAmount) {
      // We have enough of this token directly
      result.remainingBalances[token] = availableAmount - requiredAmount
      result.steps.push({
        fromToken: token,
        toToken: token,
        fromAmount: requiredAmount,
        toAmount: requiredAmount,
        fee: 0n,
      })
      continue
    }

    // Handle case where we have some of the required token but not enough
    const remainingRequired = requiredAmount - availableAmount

    // Use whatever amount of the token we do have
    if (availableAmount > 0n) {
      result.steps.push({
        fromToken: token,
        toToken: token,
        fromAmount: availableAmount,
        toAmount: availableAmount,
        fee: 0n,
      })
      result.remainingBalances[token] = 0n
    }

    // Find best sources for the remaining required amount
    const sourceResult = findOptimalTokenSources(
      result.remainingBalances,
      remainingRequired,
      token,
      feeBasisPoints
    )

    if (!sourceResult.success) {
      result.success = false
      break
    }

    // Apply all the steps from the source result
    for (const step of sourceResult.steps) {
      result.remainingBalances[step.fromToken] -= step.fromAmount
      result.steps.push(step)
    }
  }

  return result
}
