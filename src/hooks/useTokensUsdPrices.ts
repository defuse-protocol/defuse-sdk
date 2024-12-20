import { useQuery } from "@tanstack/react-query"
import { tokens } from "src/services/tokensUsdPricesHttpClient"
import type { TokenUsdPriceInfo } from "src/services/tokensUsdPricesHttpClient/types"

export const tokensUsdPricesQueryKey = ["tokens-usd-prices"]
export type TokenUsdPriceData = Record<
  TokenUsdPriceInfo["defuse_asset_id"],
  TokenUsdPriceInfo
>
async function tokensPriceDataInUsd(): Promise<TokenUsdPriceData> {
  const data = await tokens()
  const result: TokenUsdPriceData = {}
  for (const token of data.items) {
    result[token.defuse_asset_id] = token
  }
  return result
}

export const useTokensUsdPrices = () =>
  useQuery({
    queryKey: tokensUsdPricesQueryKey,
    queryFn: tokensPriceDataInUsd,
  })
