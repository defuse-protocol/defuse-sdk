import { useQuery } from "@tanstack/react-query"
import { tokens } from "src/services/tokensUsdPricesHttpClient"
import type { TokenUsdPrices } from "src/services/tokensUsdPricesHttpClient/types"

export const tokensUsdPricesQueryKey = ["tokens-usd-prices"]

export const useTokensUsdPrices = () =>
  useQuery({
    queryKey: tokensUsdPricesQueryKey,
    queryFn: async () => {
      const data = await tokens()
      const result: Record<TokenUsdPrices["symbol"], TokenUsdPrices> = {}
      for (const token of data.items) {
        result[token.symbol] = token
      }
      return result
    },
  })
