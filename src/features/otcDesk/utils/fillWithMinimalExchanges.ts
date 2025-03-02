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

export function computeDoubleSwapResult(
  amount: bigint,
  feeBasisPoints: bigint
): {
  received: bigint
  totalFee: bigint
} {
  // If fee is zero, no fees are charged
  if (feeBasisPoints === 0n) {
    return {
      received: amount,
      totalFee: 0n,
    }
  }

  // First swap fee (sending)
  const firstFee = (amount * feeBasisPoints + 9999n) / 10000n
  const afterFirstFee = amount - firstFee

  // Second swap fee (receiving)
  const secondFee = (afterFirstFee * feeBasisPoints + 9999n) / 10000n
  const finalAmount = afterFirstFee - secondFee

  return {
    received: finalAmount,
    totalFee: firstFee + secondFee,
  }
}

function calculateRequiredSourceAmount(
  targetAmount: bigint,
  feeBasisPoints: bigint
): bigint {
  // If fee is zero, the required amount is the same as the target amount
  if (feeBasisPoints === 0n) {
    return targetAmount
  }

  // We need to solve the equation:
  // sourceAmount - fee1 - fee2 = targetAmount
  // where fee1 = ceil(sourceAmount * feeBps / 10000)
  // and fee2 = ceil((sourceAmount - fee1) * feeBps / 10000)

  // Using a simple approximation and then adjusting up if needed
  let sourceAmount = (targetAmount * 10000n) / (10000n - 2n * feeBasisPoints)

  while (true) {
    const result = computeDoubleSwapResult(sourceAmount, feeBasisPoints)
    if (result.received >= targetAmount) {
      return sourceAmount
    }
    sourceAmount += 1n
  }
}

// Find best sources combining multiple tokens if necessary
function findBestSourceTokens(
  remainingBalances: TokenBalances,
  requiredAmount: bigint,
  excludeToken: string,
  feeBasisPoints: bigint
): { steps: FillStep[]; success: boolean } {
  const sourceAmount = calculateRequiredSourceAmount(
    requiredAmount,
    feeBasisPoints
  )

  // Try to find a single token first (original approach)
  for (const [token, balance] of Object.entries(remainingBalances)) {
    if (token !== excludeToken && balance >= sourceAmount) {
      // We found a single token with sufficient balance
      const swapResult = computeDoubleSwapResult(sourceAmount, feeBasisPoints)

      return {
        steps: [
          {
            fromToken: token,
            toToken: excludeToken,
            fromAmount: sourceAmount,
            toAmount: swapResult.received,
            fee: swapResult.totalFee,
          },
        ],
        success: true,
      }
    }
  }

  // If no single token is sufficient, try combining tokens
  // Sort tokens by balance (descending) to use larger balances first
  const sortedTokens = Object.entries(remainingBalances)
    .filter(([token]) => token !== excludeToken)
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
      const swapResult = computeDoubleSwapResult(amountToUse, feeBasisPoints)

      steps.push({
        fromToken: token,
        toToken: excludeToken,
        fromAmount: amountToUse,
        toAmount: swapResult.received,
        fee: swapResult.totalFee,
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

    // Find best sources, possibly combining multiple tokens
    const sourceResult = findBestSourceTokens(
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
