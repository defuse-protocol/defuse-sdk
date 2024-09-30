import { useEffect, useState } from "react"

export const useShortAccountId = (address: string) => {
  const [shortAccountId, setShortAccountId] = useState(address)

  useEffect(() => {
    if (address && address.length >= 34) {
      setShortAccountId(
        `${address.substring(0, 4)}...${address.substring(address.length - 5, address.length)}`
      )
    } else {
      setShortAccountId(address)
    }
  }, [address])

  return {
    shortAccountId,
  }
}
