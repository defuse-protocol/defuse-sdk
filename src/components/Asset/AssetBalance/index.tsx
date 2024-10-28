import { useCallback, useEffect, useState } from "react"
import {
  useGetNearNativeBalance,
  useGetNearNep141BalanceAccount,
} from "src/hooks/useNearGetTokenBalance"
import { useUser } from "src/providers/UserContext"
import type { SwappableToken } from "src/types"
import type { BaseTokenInfo } from "src/types/base"
import { isBaseToken } from "src/utils"
import { assert } from "src/utils/assert"
import { formatTokenValue } from "../../../utils/format"

type AssetBalanceProps = {
  asset: SwappableToken
}

export const AssetBalance = ({ asset }: AssetBalanceProps) => {
  const [balance, setBalance] = useState<bigint | null>(null)
  const { userAddress } = useUser()

  const { data: balanceData, mutate: mutateNearNep141BalanceAccount } =
    useGetNearNep141BalanceAccount({ retry: true })
  const { data: balanceNativeData, mutate: mutateNearNativeBalance } =
    useGetNearNativeBalance({ retry: true })

  const fetchBalance = useCallback(() => {
    const fetchRouter = (asset: BaseTokenInfo) => {
      switch (asset.chainName) {
        case "near":
          mutateNearNep141BalanceAccount({
            tokenAddress: asset.address,
            userAddress,
          })
          asset.address === "wrap.near" &&
            mutateNearNativeBalance({
              userAddress,
            })
          break
        default:
          assert(asset, "Unsupported chain")
      }
    }

    if (isBaseToken(asset)) {
      fetchRouter(asset)
    } else {
      for (const groupedToken of asset.groupedTokens) {
        fetchRouter(groupedToken)
      }
    }
  }, [
    asset,
    userAddress,
    mutateNearNep141BalanceAccount,
    mutateNearNativeBalance,
  ])

  useEffect(() => {
    const newBalance = balanceData ?? balanceNativeData ?? null
    if (newBalance !== null) {
      setBalance((prev) => (prev ? prev + newBalance : newBalance))
    }
  }, [balanceData, balanceNativeData])

  useEffect(() => {
    void fetchBalance()
  }, [fetchBalance])

  return (
    <div>
      {balance != null
        ? formatTokenValue(balance, asset.decimals, {
            min: 0.0001,
            fractionDigits: 4,
          })
        : null}
    </div>
  )
}
