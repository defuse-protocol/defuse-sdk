import { useTokenBalancesQuery } from "../../../../../queries/poaBridgeQueries"
import type { TokenBalances } from "../../../../../services/poaBridgeHttpClient/types"
import type { SwappableToken } from "../../../../../types/swap"
import { tokenAccountIdToDefuseAssetId } from "../../../../../utils/tokenUtils"

export const useTokenBalances = (
  token: SwappableToken,
  hasAnyBalance: boolean
) => {
  const { data } = useTokenBalancesQuery(token, hasAnyBalance)

  const balances: Record<string, TokenBalances> = {}
  if (data) {
    for (const balance of data) {
      balances[tokenAccountIdToDefuseAssetId(balance.nearAddress)] = balance
    }
  }

  return balances
}
