import { useQuery } from "@tanstack/react-query"
import { createDepositedBalanceQueryOptions } from "../../../../../queries/balanceQueries"
import type { IntentsUserId } from "../../../../../types/intentsUserId"
import type { SwappableToken } from "../../../../../types/swap"
import { assert } from "../../../../../utils/assert"
import { isBaseToken } from "../../../../../utils/token"
import {
  areAllTokenAddressesSame,
  mapDepositBalancesToDecimals,
} from "../utils"

export function useDepositBalances(
  {
    userId,
    token,
  }: {
    userId: IntentsUserId | null
    token: SwappableToken
  },
  enabled = true
) {
  assert(userId != null)

  const tokenIds = isBaseToken(token)
    ? [token.defuseAssetId]
    : token.groupedTokens.map((token) => token.defuseAssetId)

  // if all addresses in token are the same, there is no need to check solver
  const areTokenAddressesSame = areAllTokenAddressesSame(token)

  const { data: depositBalances } = useQuery(
    createDepositedBalanceQueryOptions(
      { userId, tokenIds },
      enabled && !areTokenAddressesSame
    )
  )

  return mapDepositBalancesToDecimals(depositBalances, token)
}
