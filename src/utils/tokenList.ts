import { NEAR_TOKEN_META, W_NEAR_TOKEN_META } from "src/constants"
import { BaseTokenInfo } from "src/types/base"

/**
 * Wrap Near has to be applied to Native Near and goes in conjunction on Swap.
 *
 * Additional Notes:
 * - Use Withdrawal of wNear if amount of Swap event less than user Native Near balance and less than user Native Near balance plus wNear balance.
 */
export const tieNativeToWrapToken = (
  tokenList: BaseTokenInfo[]
): BaseTokenInfo[] => {
  return tokenList.reduce<BaseTokenInfo[]>((acc, token, i, arr) => {
    if (token.defuseAssetId === W_NEAR_TOKEN_META.defuseAssetId) {
      return acc
    }
    if (token.defuseAssetId === NEAR_TOKEN_META.defuseAssetId) {
      const findWNear = arr.find(
        (token) => token.defuseAssetId === W_NEAR_TOKEN_META.defuseAssetId
      )
      if (findWNear) {
        const balanceNear = token?.balance ?? 0
        const balanceNearUsd = token?.balanceUsd ?? 0
        const balanceWNear = findWNear?.balance ?? 0
        const balanceWNearUsd = findWNear?.balanceUsd ?? 0

        const totalBalance = (
          BigInt(balanceNear) + BigInt(balanceWNear)
        ).toString()
        const totalBalanceUsd = Number(balanceNearUsd) + Number(balanceWNearUsd)

        acc.push({
          ...token,
          balance: totalBalance,
          balanceUsd: totalBalanceUsd.toString(),
        })
        return acc
      }
    }
    acc.push(token)
    return acc
  }, [])
}

export const sortByTopBalances = (
  tokenA: BaseTokenInfo,
  tokenB: BaseTokenInfo
) => {
  const balanceA = BigInt(tokenA?.balance ?? "0")
  const balanceB = BigInt(tokenB?.balance ?? "0")

  if (balanceA < balanceB) {
    return 1
  }
  if (balanceA > balanceB) {
    return -1
  }
  return 0
}
