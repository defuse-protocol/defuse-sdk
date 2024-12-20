import { Callout } from "@radix-ui/themes"
import type { TokenUsdPriceData } from "src/hooks/useTokensUsdPrices"
import type { BaseTokenInfo } from "src/types"
import { formatUnits } from "viem"
import styles from "./styles.module.css"

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
  //4990 is an approximate threshold of what is considered big withdrawal. (Not 5k as USDT/USDC can be 0.99)
  return Number(formatUnits(amountIn, token.decimals)) * tokenPrice >= 4990 ? (
    <Callout.Root
      size="1"
      color="yellow"
      variant="soft"
      className={styles.longWithdrawCalloutRoot}
    >
      <Callout.Text size="1" weight="bold">
        Withdrawal over ~5,000$ may take longer to process.
      </Callout.Text>
    </Callout.Root>
  ) : null
}
