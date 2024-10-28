import { useCallback } from "react"

import { formatUnits } from "viem"
import { AssetBalance } from "./AssetBalance"

export const AssetBalanceAdapter = ({
  balances,
  nearBalance,
  decimals,
  defuseAssetId,
}: {
  balances: Record<string, bigint>
  nearBalance: bigint
  decimals: number
  defuseAssetId?: string
}) => {
  const calculateBalance = useCallback(() => {
    if (!balances || !defuseAssetId) {
      return "0"
    }
    const tokenIds = defuseAssetId.split(",")
    const isGroupedToken = tokenIds.length > 1
    if (isGroupedToken) {
      return tokenIds.reduce((acc, assetId) => {
        const balance = formatUnits(balances[assetId] ?? BigInt(0), decimals)
        return (Number(acc) + Number(balance)).toString()
      }, "0")
    }
    if (defuseAssetId === "nep141:wrap.near") {
      return formatUnits(
        (balances[defuseAssetId] ?? BigInt(0)) + nearBalance,
        decimals
      )
    }
    return formatUnits(balances[defuseAssetId] ?? BigInt(0), decimals)
  }, [balances, defuseAssetId, decimals, nearBalance])

  return <AssetBalance balance={calculateBalance()} />
}
