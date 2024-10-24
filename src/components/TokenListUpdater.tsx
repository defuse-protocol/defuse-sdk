import { useEffect } from "react"
import { useTokensStore } from "../providers/TokensStoreProvider"
import type { SwappableToken } from "../types"

export function TokenListUpdater({
  tokenList,
}: { tokenList: SwappableToken[] }) {
  const { updateTokens } = useTokensStore((state) => state)

  useEffect(() => {
    updateTokens(tokenList)
  }, [tokenList, updateTokens])

  return null
}
