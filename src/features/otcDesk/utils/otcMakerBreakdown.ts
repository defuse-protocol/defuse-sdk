import type { TokenValue } from "../../../types/base"
import { subtractAmounts } from "../../../utils/tokenUtils"
import type { TradeBreakdown } from "../types/sharedTypes"

export function computeTradeBreakdown(params: {
  amountIn: TokenValue
  amountOut: TokenValue
  fee: number
}): TradeBreakdown {
  const takerSends = {
    amount: grossUpAmount(params.amountOut.amount, params.fee),
    decimals: params.amountOut.decimals,
  }
  const takerReceives = {
    amount: netDownAmount(params.amountIn.amount, params.fee),
    decimals: params.amountIn.decimals,
  }

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
export function netDownAmount(amount: bigint, feeBip: number): bigint {
  if (feeBip < 0 || feeBip > Number(BASIS_POINTS_DENOMINATOR)) {
    throw new Error("Invalid feeBip value. It must be between 0 and 10000.")
  }

  if (amount === 0n || feeBip === 0) return amount

  // Multiply first to maintain precision, then add BASIS_POINTS_DENOMINATOR-1 for ceiling division
  const feeAmount =
    (amount * BigInt(feeBip) + (BASIS_POINTS_DENOMINATOR - 1n)) /
    BASIS_POINTS_DENOMINATOR

  return amount - feeAmount
}

/**
 * Calculates gross amount needed to achieve desired net amount after fee.
 * @example
 * // To receive net 100000n after 0.3% fee, gross amount needed is 100300n
 * grossUpAmount({ amount: 100000n, decimals: 6 }, 30) == 100300n
 */
export function grossUpAmount(amount: bigint, feeBip: number): bigint {
  if (feeBip < 0 || feeBip > Number(BASIS_POINTS_DENOMINATOR)) {
    throw new Error("Invalid feeBip value. It must be between 0 and 10000.")
  }

  if (amount === 0n || feeBip === 0) return amount

  const feeMultiplier = BASIS_POINTS_DENOMINATOR - BigInt(feeBip)
  // Multiply first, then add (denominator-1) for ceiling division
  const grossAmount =
    (amount * BASIS_POINTS_DENOMINATOR + (feeMultiplier - 1n)) / feeMultiplier

  return grossAmount
}
