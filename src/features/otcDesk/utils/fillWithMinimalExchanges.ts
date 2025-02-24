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

function findBestSourceToken(
  remainingBalances: TokenBalances,
  requiredAmount: bigint,
  excludeToken: string,
  feeBasisPoints: bigint
): { token: string; amount: bigint } | null {
  let bestToken = ""
  let bestRequiredAmount = 0n
  let minExcessBalance = BigInt(Number.MAX_SAFE_INTEGER)

  const sourceAmount = calculateRequiredSourceAmount(
    requiredAmount,
    feeBasisPoints
  )

  for (const [token, balance] of Object.entries(remainingBalances)) {
    if (token !== excludeToken && balance >= sourceAmount) {
      const excessBalance = balance - sourceAmount
      if (excessBalance < minExcessBalance) {
        bestToken = token
        bestRequiredAmount = sourceAmount
        minExcessBalance = excessBalance
      }
    }
  }

  if (bestToken === "") {
    return null
  }

  return {
    token: bestToken,
    amount: bestRequiredAmount,
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

    const remainingRequired = requiredAmount - availableAmount
    result.remainingBalances[token] = 0n

    if (availableAmount !== 0n) {
      result.steps.push({
        fromToken: token,
        toToken: token,
        fromAmount: availableAmount,
        toAmount: availableAmount,
        fee: 0n,
      })
    }

    // Find best token to exchange from
    const bestSource = findBestSourceToken(
      result.remainingBalances,
      remainingRequired,
      token,
      feeBasisPoints
    )

    if (!bestSource) {
      result.success = false
      break
    }

    // Execute the swap
    const swapResult = computeDoubleSwapResult(
      bestSource.amount,
      feeBasisPoints
    )
    result.remainingBalances[bestSource.token] -= bestSource.amount

    result.steps.push({
      fromToken: bestSource.token,
      toToken: token,
      fromAmount: bestSource.amount,
      toAmount: swapResult.received,
      fee: swapResult.totalFee,
    })
  }

  return result
}
