export enum BaseTokenConvertEnum {
  USD = "usd",
}

export type BaseTokenBalance = {
  balance: string
  balanceUsd: string
  convertedLast: {
    [key in BaseTokenConvertEnum]: string
  }
}

export interface BaseTokenInfo extends Partial<BaseTokenBalance> {
  defuseAssetId: string
  address: string
  symbol: string
  name: string
  decimals: number
  icon: string
  chainId: string
  chainIcon: string
  chainName: string
  routes: string[]
}