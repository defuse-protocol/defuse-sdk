import type { TokenValue } from "../../types/base"
import { subtractAmounts } from "../../utils/tokenUtils"

export function computeTradeBreakdown(params: {
  amountIn: TokenValue
  amountOut: TokenValue
  fee: number
}) {
  const takerSends = grossUpAmount(params.amountOut, params.fee)
  const takerReceives = netDownAmount(params.amountIn, params.fee)

  return {
    makerSends: params.amountIn,
    makerReceives: params.amountOut,
    makerPaysFee: subtractAmounts(params.amountIn, takerReceives),
    takerSends,
    takerReceives,
    takerPaysFee: subtractAmounts(takerSends, params.amountOut),
  }
}

// It's 100%
const BASIS_POINTS_DENOMINATOR = 10_000n

/**
 * Calculates net amount by deducting fee from gross amount.
 * @example
 * // If gross amount is 100000n with 0.3% fee, net amount is 99700n
 * netDownAmount({ amount: 100000n, decimals: 6 }, 30) == 99700n
 */
function netDownAmount(amount: TokenValue, feeBip: number): TokenValue {
  if (feeBip < 0 || feeBip > Number(BASIS_POINTS_DENOMINATOR)) {
    throw new Error("Invalid feeBip value. It must be between 0 and 10000.")
  }

  const feeAmount = (amount.amount * BigInt(feeBip)) / BASIS_POINTS_DENOMINATOR

  return {
    amount: amount.amount - feeAmount,
    decimals: amount.decimals,
  }
}

/**
 * Calculates gross amount needed to achieve desired net amount after fee.
 * @example
 * // To receive net 100000n after 0.3% fee, gross amount needed is 100300n
 * grossUpAmount({ amount: 100000n, decimals: 6 }, 30) == 100300n
 */
function grossUpAmount(amount: TokenValue, feeBip: number): TokenValue {
  if (feeBip < 0 || feeBip > Number(BASIS_POINTS_DENOMINATOR)) {
    throw new Error("Invalid feeBip value. It must be between 0 and 10000.")
  }

  const feeMultiplier = BASIS_POINTS_DENOMINATOR - BigInt(feeBip)
  const grossAmount = (amount.amount * BASIS_POINTS_DENOMINATOR) / feeMultiplier

  return {
    amount: grossAmount,
    decimals: amount.decimals,
  }
}
