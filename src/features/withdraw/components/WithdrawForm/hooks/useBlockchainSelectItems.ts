import type { TokenUsdPriceData } from "../../../../../hooks/useTokensUsdPrices"
import type { TokenBalances } from "../../../../../services/poaBridgeHttpClient/types"
import type { SwappableToken } from "../../../../../types/swap"
import { assert } from "../../../../../utils/assert"
import { allBlockchains } from "../constants"
import { getAvailableBlockchains } from "../utils"

export const useBlockchainSelectItems = (
  token: SwappableToken,
  balances: { [address: string]: TokenBalances },
  tokensUsdPriceData?: TokenUsdPriceData
) => {
  const availableBlockchains = getAvailableBlockchains(token)

  return Object.fromEntries(
    allBlockchains
      .filter((blockchain) => availableBlockchains[blockchain.value])
      .map((a) => {
        const address = availableBlockchains[a.value]
        assert(address != null)

        let hotBalance = null
        const balance = balances[address]

        if (balance != null) {
          let price = 1
          if (tokensUsdPriceData) {
            price = tokensUsdPriceData[address]?.price ?? 1
          }

          hotBalance = {
            amount: BigInt(balance.vaultBalance),
            decimals: balance.decimals,
            price,
          }
        }

        return [a.value, { ...a, hotBalance }]
      })
  )
}
