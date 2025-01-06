import { Callout } from "@radix-ui/themes"
import type { TokenUsdPriceData } from "src/hooks/useTokensUsdPrices"
import { formatUnits } from "viem"
import type { BaseTokenInfo } from "../../../../../types/base"

export default function LongWithdrawWarning({
  amountIn,
  token,
  tokensUsdPriceData,
}: {
  amountIn: bigint | null
  token: BaseTokenInfo
  tokensUsdPriceData?: TokenUsdPriceData
}) {
  if (amountIn === null || !tokensUsdPriceData) {
    return null
  }
  const tokenPrice = tokensUsdPriceData[token.defuseAssetId]?.price
  if (!tokenPrice) return null
  //4990 is an approximate threshold of what is considered big withdrawal. (As USDT/USDC is ~1$)
  return Number(formatUnits(amountIn, token.decimals)) * tokenPrice >= 4990 ? (
    <Callout.Root size="1" color="yellow" variant="soft" className="px-3 py-2">
      <Callout.Text size="1" weight="bold">
        Withdrawal over ~5,000$ may take longer to process.
      </Callout.Text>
    </Callout.Root>
  ) : null
}
