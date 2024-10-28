import { parseUnits } from "ethers"

export const balanceToBignumberString = (
  balance: string,
  decimal: number
): string => {
  if (!balance || balance.trim() === "") {
    return "0"
  }
  return parseUnits(balance, decimal).toString()
}
