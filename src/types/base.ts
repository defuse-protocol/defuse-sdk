export interface TokenExchangeBase {
  tokenIn: string
  tokenOut: string
}

enum TokenConvertEnum {
  USD = "usd",
}

export type TokenBalanceBase = {
  balance?: number
  balanceToUsd?: number
  convertedLast?: {
    [key in TokenConvertEnum]: number
  }
}

export interface TokenInfoBase extends TokenBalanceBase {
  address: string
  symbol: string
  name: string
  decimals: number
  blockchain: string
  icon?: string
}

export type DefuseIdBase = {
  defuseAssetId: string
}

export interface NetworkTokenBase extends Partial<TokenInfoBase>, DefuseIdBase {
  chainId?: string
  chainIcon?: string
  chainName?: string
}
