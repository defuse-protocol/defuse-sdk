export enum BaseTokenConvertEnum {
  USD = "usd",
}

export type BaseTokenBalance = {
  /** bigint in string */
  balance: string
  balanceUsd?: string
  convertedLast?: {
    [key in BaseTokenConvertEnum]: string
  }
}

export type SupportedChainName =
  | "eth"
  | "near"
  | "base"
  | "arbitrum"
  | "bitcoin"
  | "solana"
  | "dogecoin"
  | "turbochain"
  | "aurora"
  | "xrpledger"
  | "zcash"

export interface FungibleTokenInfo extends Partial<BaseTokenBalance> {
  defuseAssetId: string
  address: string
  symbol: string
  name: string
  decimals: number
  icon: string
  /** @deprecated */
  chainId: string
  chainIcon: string
  chainName: SupportedChainName
  /** @deprecated */
  routes: string[]
}

export interface NativeTokenInfo extends Partial<BaseTokenBalance> {
  defuseAssetId: string
  type: "native"
  symbol: string
  name: string
  decimals: number
  icon: string
  /** @deprecated */
  chainId: string
  chainIcon: string
  chainName: SupportedChainName
  /** @deprecated */
  routes: string[]
}

export type BaseTokenInfo = FungibleTokenInfo | NativeTokenInfo

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
  icon: string
  groupedTokens: BaseTokenInfo[]
}

export interface TokenValue {
  amount: bigint
  decimals: number
}
