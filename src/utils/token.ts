import { formatUnits } from "viem"

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
