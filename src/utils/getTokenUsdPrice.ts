import type { TokenUsdPriceData } from "src/hooks/useTokensUsdPrices"
import type { SwappableToken } from "src/types/swap"
import { isBaseToken, isUnifiedToken } from "./token"

const getTokenUsdPrice = (
  tokenAmount: string,
  token: SwappableToken | null,
  tokensUsdPriceData?: TokenUsdPriceData
): number | null => {
  if (
    !tokensUsdPriceData ||
    !token ||
    !tokenAmount ||
    Number.isNaN(+tokenAmount)
  )
    return null
  let tokenUsdPriceData = null
  if (isBaseToken(token) && tokensUsdPriceData[token.defuseAssetId]) {
    tokenUsdPriceData = tokensUsdPriceData[token.defuseAssetId]
  } else if (isUnifiedToken(token)) {
    for (const groupedToken of token.groupedTokens) {
      if (
        isBaseToken(groupedToken) &&
        tokensUsdPriceData[groupedToken.defuseAssetId]
      ) {
        tokenUsdPriceData = tokensUsdPriceData[groupedToken.defuseAssetId]
        break
      }
    }
  }
  if (!tokenUsdPriceData) return null
  return Number(tokenAmount) * tokenUsdPriceData?.price
}
export default getTokenUsdPrice
