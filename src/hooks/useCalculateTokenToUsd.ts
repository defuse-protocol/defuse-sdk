import { useState } from "react"

import type { BaseTokenInfo } from "../types/base"

export const useCalculateTokenToUsd = () => {
  const [priceToUsd, setPriceToUsd] = useState("0")

  const calculateTokenToUsd = (
    amount: string,
    selectToken: BaseTokenInfo | undefined
  ) => {
    if (!selectToken || !Number.parseFloat(amount)) {
      setPriceToUsd("0")
      return
    }
    const convertPrice = selectToken?.convertedLast?.usd || 0
    const amountToUsd = convertPrice
      ? (Number(amount) * Number(convertPrice)).toString()
      : "0"
    setPriceToUsd(amountToUsd)
  }

  return {
    priceToUsd,
    calculateTokenToUsd,
  }
}
