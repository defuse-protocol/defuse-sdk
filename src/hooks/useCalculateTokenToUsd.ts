import { useState } from "react"

import { SelectToken } from "../types"

export const useCalculateTokenToUsd = () => {
  const [priceToUsd, setPriceToUsd] = useState("0")

  const calculateTokenToUsd = (amount: string, selectToken: SelectToken) => {
    if (!selectToken || !parseFloat(amount)) return
    const convertPrice = selectToken?.convertedLast?.usd
    const amountToUsd = convertPrice
      ? (Number(amount) * convertPrice).toString()
      : "0"
    setPriceToUsd(amountToUsd)
  }

  return {
    priceToUsd,
    calculateTokenToUsd,
  }
}
