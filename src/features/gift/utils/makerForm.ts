export function getButtonText(
  balanceInsufficient: boolean,
  editing: boolean,
  processing: boolean
) {
  if (balanceInsufficient) {
    return "Insufficient Balance"
  }
  if (processing) {
    return "Processing..."
  }
  if (editing) {
    return "Create gift link"
  }
  return "Confirm transaction in your wallet..."
}

export function checkInsufficientBalance(
  formAmount: string,
  tokenBalance?: { amount: bigint; decimals: number }
): boolean {
  if (tokenBalance == null) {
    return false
  }
  if (formAmount.length === 0) {
    return false
  }
  if (formAmount === ".") {
    return false
  }
  const invalidFormAmount = !/^-?\d*\.?\d*$/.test(formAmount)
  if (invalidFormAmount) {
    return false
  }
  const conversionFactor = 10 ** tokenBalance.decimals
  const formAmountBigInt = BigInt(
    Math.round(Number.parseFloat(formAmount) * conversionFactor)
  )
  return formAmountBigInt > tokenBalance.amount
}
