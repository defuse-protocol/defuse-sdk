import type { BalanceMapping } from "src/features/machines/depositedBalanceMachine"

export function convertTokenDiffToBigInt(
  tokenDiff: Record<string, bigint | string>
): BalanceMapping {
  const result: BalanceMapping = {}
  for (const [key, value] of Object.entries(tokenDiff)) {
    result[key] = typeof value === "bigint" ? value : BigInt(value)
  }
  return result
}
