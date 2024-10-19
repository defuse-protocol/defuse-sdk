import { formatUnits } from "viem"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../types/base"

export const smallBalanceToFormat = (balance: string, toFixed = 14): string => {
  if (!Number.parseFloat(balance)) {
    return balance
  }
  const isSmallBalance = Number.parseFloat(balance) < 0.00001
  if (isSmallBalance) {
    return "~0.00001"
  }
  return Number.parseFloat(balance.substring(0, toFixed)).toString()
}

export const tokenBalanceToFormatUnits = ({
  balance,
  decimals,
}: {
  balance: string | undefined
  decimals: number
}): string => {
  if (balance == null || !Number.parseFloat(balance?.toString() ?? "0")) {
    return "0"
  }
  const balanceToUnits = formatUnits(
    BigInt(balance.toString()),
    decimals
  ).toString()

  return smallBalanceToFormat(balanceToUnits, 7)
}

export function isBaseToken(
  token: BaseTokenInfo | UnifiedTokenInfo
): token is BaseTokenInfo {
  return "defuseAssetId" in token
}

export function isUnifiedToken(
  token: BaseTokenInfo | UnifiedTokenInfo
): token is UnifiedTokenInfo {
  return "unifiedAssetId" in token
}
