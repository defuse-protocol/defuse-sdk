import { formatUnits } from "viem"
import type { TokenUsdPriceData } from "../../../../hooks/useTokensUsdPrices"
import type { TokenBalances } from "../../../../services/poaBridgeHttpClient/types"
import { AuthMethod } from "../../../../types/authHandle"
import type { SupportedChainName, TokenValue } from "../../../../types/base"
import type { SwappableToken } from "../../../../types/swap"
import { assert } from "../../../../utils/assert"
import { isBaseToken } from "../../../../utils/token"
import { compareAmounts } from "../../../../utils/tokenUtils"
import { allBlockchains } from "./constants"
import type { TokenValueWithPrice } from "./types"

export function chainTypeSatisfiesChainName(
  chainType: AuthMethod | undefined,
  chainName: SupportedChainName
) {
  if (chainType == null) return false

  switch (true) {
    case chainType === AuthMethod.Near && chainName === "near":
    case chainType === AuthMethod.EVM && chainName === "eth":
    case chainType === AuthMethod.EVM && chainName === "arbitrum":
    case chainType === AuthMethod.EVM && chainName === "base":
    case chainType === AuthMethod.EVM && chainName === "turbochain":
    case chainType === AuthMethod.EVM && chainName === "aurora":
    case chainType === AuthMethod.EVM && chainName === "gnosis":
    case chainType === AuthMethod.EVM && chainName === "berachain":
    case chainType === AuthMethod.Solana && chainName === "solana":
      return true
  }

  return false
}

export function truncateUserAddress(hash: string) {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

export const adjustTo1kUsd = (tokenValue: TokenValueWithPrice): number => {
  if (tokenValue.amount === 0n) {
    return 0
  }

  const rounded = Math.round(
    (Number(formatUnits(tokenValue.amount, tokenValue.decimals)) *
      tokenValue.price) /
      1000 // 1k
  )

  return rounded === 0 ? 1 : rounded
}

export const getAvailableBlockchains = (token: SwappableToken) =>
  isBaseToken(token)
    ? { [token.chainName]: token.defuseAssetId }
    : token.groupedTokens.reduce((acc: { [key: string]: string }, curr) => {
        acc[curr.chainName] = curr.defuseAssetId
        return acc
      }, {})

export const shouldShowHotBalance = (
  balances: { [address: string]: TokenBalances },
  tokenInBalance?: TokenValue
) => {
  const { amount: userBalance, decimals: userBalanceDecimals } =
    tokenInBalance ?? { amount: 0n, decimals: 1 }
  let showHotBalances = userBalance > 0

  let anyHotBalanceIsLessThanUserBalance = false
  for (const address in balances) {
    const balance = balances[address] as TokenBalances

    if (
      compareAmounts(
        { amount: userBalance, decimals: userBalanceDecimals },
        { amount: BigInt(balance.vaultBalance), decimals: balance.decimals }
      ) > 0
    ) {
      // we should show in case user's balance is MORE than any of the HOT chain balances
      anyHotBalanceIsLessThanUserBalance = true
    }
  }

  showHotBalances = showHotBalances && anyHotBalanceIsLessThanUserBalance

  return {
    showHotBalances,
  }
}

export const getBlockchainSelectItems = (
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

        let hotBalance: TokenValueWithPrice | null = null
        const balance = balances[address]
        const price = tokensUsdPriceData?.[address]?.price

        if (balance != null && price != null) {
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
