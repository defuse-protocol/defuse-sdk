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

/**
 * A virtual aggregation of the same token across multiple blockchains.
 * This is not an on-chain token but a unified view of network-specific tokens
 * with shared properties.
 *
 * The name avoids "NativeMultichainAsset" to clarify that it doesn't represent
 * an actual multichain token, just a virtual abstraction.
 */
export interface UnifiedTokenInfo {
  unifiedAssetId: string
  symbol: string
  name: string
  decimals: number
  icon: string
  groupedTokens: BaseTokenInfo[]
}
