import type { TokenUsdPriceData } from "../../../../../hooks/useTokensUsdPrices"
import { useTokenBalancesQueryOptions } from "../../../../../queries/poaBridgeQueries"
import type { TokenBalances } from "../../../../../services/poaBridgeHttpClient/types"
import type { TokenValue } from "../../../../../types/base"
import type { SwappableToken } from "../../../../../types/swap"
import { isBaseToken } from "../../../../../utils/token"
import {
  addNep141ToAddress,
  compareAmounts,
  filterOutPoaBridgeTokens,
  getTokenAssetIdsWithoutNep141,
} from "../../../../../utils/tokenUtils"
import { allBlockchains } from "../constants"

export const useBlockchainSelectItems = (
  token: SwappableToken,
  tokensUsdPriceData?: TokenUsdPriceData,
  tokenInBalance?: TokenValue
) => {
  const availableBlockchains = isBaseToken(token)
    ? { [token.chainName]: token.defuseAssetId }
    : token.groupedTokens.reduce((acc: { [key: string]: string }, curr) => {
        acc[curr.chainName] = curr.defuseAssetId
        return acc
      }, {})

  const onlyPoaToken = filterOutPoaBridgeTokens(token)
  const addresses = onlyPoaToken
    ? getTokenAssetIdsWithoutNep141(onlyPoaToken)
    : []
  const { amount: userBalance, decimals: userBalanceDecimals } =
    tokenInBalance || { amount: 0n, decimals: 1 }
  let showHotBalances = userBalance > 0

  const { data } = useTokenBalancesQueryOptions(addresses, showHotBalances)

  let anyHotBalanceIsLessThanUserBalance = false

  const balances =
    data?.reduce((acc: { [key: string]: TokenBalances }, curr) => {
      if (
        compareAmounts(
          { amount: userBalance, decimals: userBalanceDecimals },
          { amount: BigInt(curr.vaultBalance), decimals: curr.decimals }
        ) > 0
      ) {
        // we should show in case user's balance is MORE than any of the HOT chain balances
        anyHotBalanceIsLessThanUserBalance = true
      }

      acc[addNep141ToAddress(curr.nearAddress)] = curr
      return acc
    }, {}) || {}

  showHotBalances = showHotBalances && anyHotBalanceIsLessThanUserBalance

  const blockchainSelectItems = Object.fromEntries(
    allBlockchains
      .filter((blockchain) => availableBlockchains[blockchain.value])
      .map((a) => {
        const address = availableBlockchains[a.value]
        let hotBalance = null

        if (address != null) {
          if (balances[address]?.vaultBalance != null) {
            let price = 1
            if (tokensUsdPriceData) {
              price = tokensUsdPriceData[address]?.price ?? 1
            }

            hotBalance = {
              amount: BigInt((balances[address] as TokenBalances).vaultBalance),
              decimals: (balances[address] as TokenBalances).decimals,
              price,
            }
          }
        }

        return [a.value, { ...a, hotBalance }]
      })
  )

  return {
    blockchainSelectItems,
    showHotBalances,
  }
}
