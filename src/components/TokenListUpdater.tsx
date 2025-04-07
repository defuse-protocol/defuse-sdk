import { useEffect } from "react"
import type { BaseTokenInfo, UnifiedTokenInfo } from "src/types/base"
import type { SwappableToken } from "src/types/swap"
import { useTokensStore } from "../providers/TokensStoreProvider"

export function TokenListUpdater<
  T extends {
    tokenList: (BaseTokenInfo | UnifiedTokenInfo | SwappableToken)[]
  },
>({ tokenList }: { tokenList: T["tokenList"] }) {
  const { updateTokens } = useTokensStore((state) => state)

  useEffect(() => {
    updateTokens(tokenList)
  }, [tokenList, updateTokens])

  return null
}
