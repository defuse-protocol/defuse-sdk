import { formatUnits } from "viem"
import type { TokenUsdPriceData } from "../../../../hooks/useTokensUsdPrices"
import type { TokenBalances as TokenBalancesRecord } from "../../../../services/defuseBalanceService"
import { DeprecatedTokensService } from "../../../../services/deprecatedTokensService"
import { AuthMethod } from "../../../../types/authHandle"
import type {
  BaseTokenInfo,
  SupportedChainName,
  TokenValue,
} from "../../../../types/base"
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
    case chainType === AuthMethod.EVM && chainName === "tuxappchain":
    case chainType === AuthMethod.EVM && chainName === "vertex":
    case chainType === AuthMethod.EVM && chainName === "optima":
    case chainType === AuthMethod.EVM && chainName === "coineasy":
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

export const getAvailableBlockchains = (token: SwappableToken) => {
  return isBaseToken(token)
    ? {
        [token.chainName]: {
          defuseAssetId: token.defuseAssetId,
          bridge: token.bridge,
        },
      }
    : token.groupedTokens.reduce(
        (
          acc: {
            [key: string]: {
              defuseAssetId: string
              bridge: string
            }
          },
          curr
        ) => {
          acc[curr.chainName] = {
            defuseAssetId: curr.defuseAssetId,
            bridge: curr.bridge,
          }
          return acc
        },
        {}
      )
}

export const shouldShowHotBalance = (
  balances: Record<string, TokenValue>,
  tokenInBalance?: TokenValue
): boolean => {
  const { amount: userBalance, decimals: userBalanceDecimals } =
    tokenInBalance ?? { amount: 0n, decimals: 1 }
  const userHasAnyBalance = userBalance > 0
  if (!userHasAnyBalance) {
    return false
  }

  let anyHotBalanceIsLessThanUserBalance = false
  for (const address in balances) {
    const balance = balances[address] as TokenValue

    if (
      compareAmounts(
        { amount: userBalance, decimals: userBalanceDecimals },
        { amount: BigInt(balance.amount), decimals: balance.decimals }
      ) > 0
    ) {
      // we should show in case user's balance is MORE than any of the HOT chain balances
      anyHotBalanceIsLessThanUserBalance = true
    }
  }

  return anyHotBalanceIsLessThanUserBalance
}

export const getMinAmountToken = (
  token1: TokenValue | undefined,
  token2: TokenValue | undefined
): TokenValue | undefined => {
  if (
    (token1 == null || token1.amount === 0n) &&
    (token2 == null || token2.amount === 0n)
  ) {
    return undefined
  }
  if (token1 == null || token1.amount === 0n) {
    return token2
  }
  if (token2 == null || token2.amount === 0n) {
    return token1
  }
  // we consider equal decimals
  return BigInt(token1?.amount || 0n) > BigInt(token2?.amount || 0n)
    ? token2
    : token1
}

export const getBlockchainSelectItems = (
  token: SwappableToken,
  poaBalances: Record<string, TokenValue>,
  nonPoaBalances: Record<string, TokenValue>,
  tokensUsdPriceData?: TokenUsdPriceData
) => {
  const availableBlockchains = getAvailableBlockchains(token)

  return Object.fromEntries(
    allBlockchains
      .filter((blockchain) => availableBlockchains[blockchain.value])
      .map((a) => {
        const addressData = availableBlockchains[a.value]
        assert(addressData != null)

        let hotBalance: TokenValueWithPrice | null = null
        const defuseAssetId =
          DeprecatedTokensService.makeInstance().getValidToken(
            addressData.defuseAssetId
          )
        const balance =
          addressData.bridge === "poa"
            ? getMinAmountToken(
                // we choose min between poa hot balance and solver's hot balance
                poaBalances[defuseAssetId],
                nonPoaBalances[defuseAssetId]
              )
            : nonPoaBalances[defuseAssetId]

        const price = tokensUsdPriceData?.[defuseAssetId]?.price

        if (balance != null && price != null) {
          hotBalance = {
            amount: BigInt(balance.amount),
            decimals: balance.decimals,
            price,
          }
        }

        return [a.value, { ...a, hotBalance }]
      })
  )
}

export const mergeBridgeBalances = (
  poaBalances: Record<string, TokenValue>,
  nonPoaBalances: Record<string, TokenValue>
): Record<string, TokenValue> => {
  const balances: Record<string, TokenValue> = {}

  for (const address_ in nonPoaBalances) {
    const address =
      DeprecatedTokensService.makeInstance().getValidToken(address_)
    const val = nonPoaBalances[address] ?? nonPoaBalances[address_]
    assert(val != null)
    balances[address_] = val
  }

  for (const address_ in poaBalances) {
    const address =
      DeprecatedTokensService.makeInstance().getValidToken(address_)
    const balance = balances[address]
    const balance_ =
      balance == null
        ? poaBalances[address]
        : getMinAmountToken(poaBalances[address], balances[address])

    if (balance_ != null) {
      balances[address_] = balance_
    }
  }

  return balances
}

export const mapDepositBalancesToDecimals = (
  balances: TokenBalancesRecord | undefined,
  token: SwappableToken
): Record<BaseTokenInfo["defuseAssetId"], TokenValue> => {
  const tokenValueWithPrice: Record<
    BaseTokenInfo["defuseAssetId"],
    TokenValue
  > = {}

  if (balances == null) {
    return tokenValueWithPrice
  }

  const isBaseT = isBaseToken(token)
  for (const address in balances) {
    const amount = balances[address]
    if (amount == null) {
      continue
    }

    if (isBaseT) {
      if (token.defuseAssetId === address) {
        tokenValueWithPrice[address] = { amount, decimals: token.decimals }
      }
    } else {
      const found = token.groupedTokens.find(
        (token) => token.defuseAssetId === address
      )
      if (found) {
        tokenValueWithPrice[address] = { amount, decimals: found.decimals }
      }
    }
  }

  return tokenValueWithPrice
}

export const areAllTokenAddressesSame = (token: SwappableToken) => {
  return (
    !isBaseToken(token) &&
    token.groupedTokens.every(
      (t) => t.defuseAssetId === token.groupedTokens[0]?.defuseAssetId
    )
  )
}

export const getWithdrawButtonText = (
  noLiquidity: boolean,
  insufficientTokenInAmount: boolean
) => {
  if (noLiquidity) return "No liquidity providers"
  if (insufficientTokenInAmount) return "Insufficient amount"
  return "Withdraw"
}
