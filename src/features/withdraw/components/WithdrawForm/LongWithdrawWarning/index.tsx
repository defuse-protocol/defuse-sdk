import { Callout } from "@radix-ui/themes"
import type { TokenUsdPriceData } from "src/hooks/useTokensUsdPrices"
import { formatUnits } from "viem"
import type {
  BaseTokenInfo,
  TokenValue,
  TokenValueWithPrice,
} from "../../../../../types/base"
import { adjustTo1kUsd } from "../../../../../utils/tokenUtils"

export const LongWithdrawWarning = ({
  amountIn,
  token,
  tokensUsdPriceData,
  hotBalance,
}: {
  amountIn: TokenValue | null
  token: BaseTokenInfo
  tokensUsdPriceData?: TokenUsdPriceData
  hotBalance?: TokenValueWithPrice | null
}) => {
  if (amountIn === null || !tokensUsdPriceData) {
    return null
  }
  if (!hotBalance) return null

  const tokenPrice = tokensUsdPriceData[token.defuseAssetId]?.price
  if (!tokenPrice) return null

  const cleanerHotBalance =
    Number(formatUnits(hotBalance.amount, hotBalance.decimals)) *
    hotBalance.price
  const shouldShow =
    Number(formatUnits(amountIn.amount, amountIn.decimals)) * tokenPrice >=
    cleanerHotBalance

  if (!shouldShow) return null

  const adjustedBalance = adjustTo1kUsd(hotBalance)
  const adjustedBalanceText =
    adjustedBalance === 0
      ? `Unfortunately ${adjustedBalance}`
      : `Only ~${adjustedBalance}K`

  return (
    <Callout.Root className="bg-warning px-3 py-2 text-warning-foreground">
      <Callout.Text className="font-bold text-xs">
        {adjustedBalanceText} is available for instant withdrawal on selected
        network. Withdrawals above or close to this amount may be delayed while
        we process them, or you can choose to split the amount across multiple
        networks for faster access.
      </Callout.Text>
    </Callout.Root>
  )
}
