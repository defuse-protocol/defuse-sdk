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
  // Try to find a single token first
  for (const [token, balance] of Object.entries(remainingBalances)) {
    if (token !== targetToken) {
      const sourceAmount = grossUpAmount(requiredAmount, Number(feeBasisPoints))

      if (balance >= sourceAmount) {
        // We found a single token with sufficient balance
        return {
          steps: [
            {
              fromToken: token,
              toToken: targetToken,
              fromAmount: sourceAmount,
              toAmount: requiredAmount,
              fee: sourceAmount - requiredAmount,
            },
          ],
          success: true,
        }
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

  const steps: FillStep[] = []
  let totalReceived = 0n

  // Try using tokens one by one until we reach the required amount
  for (const [token, balance] of sortedTokens) {
    if (totalReceived >= requiredAmount) {
      break
    }

    if (balance <= 0n) continue

    const stillNeeded = requiredAmount - totalReceived
    const sourceAmount = grossUpAmount(stillNeeded, Number(feeBasisPoints))
    const amountToUse = sourceAmount <= balance ? sourceAmount : balance

    if (amountToUse <= 0n) continue

    const received = netDownAmount(amountToUse, Number(feeBasisPoints))

    steps.push({
      fromToken: token,
      toToken: targetToken,
      fromAmount: amountToUse,
      toAmount: received,
      fee: amountToUse - received,
    })

    totalReceived += received
  }

  if (totalReceived < requiredAmount) {
    return { steps: [], success: false }
  }

  return { steps, success: true }
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
