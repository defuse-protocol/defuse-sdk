import type { ethers } from "ethers"
import type { Account, providers as najProviders } from "near-api-js"

export type SupportedChainName =
  | "eth"
  | "near"
  | "base"
  | "arbitrum"
  | "bitcoin"
  | "solana"
  | "dogecoin"
  | "turbochain"
  | "tuxappchain"
  | "vertex"
  | "optima"
  | "coineasy"
  | "aurora"
  | "xrpledger"
  | "zcash"
  | "gnosis"
  | "berachain"
  | "tron"

export type SupportedBridge = "direct" | "poa" | "aurora_engine"

export interface FungibleTokenInfo {
  defuseAssetId: string
  address: string
  symbol: string
  name: string
  decimals: number
  icon: string
  chainName: SupportedChainName
  bridge: SupportedBridge
}

export interface NativeTokenInfo {
  defuseAssetId: string
  type: "native"
  symbol: string
  name: string
  decimals: number
  icon: string
  chainName: SupportedChainName
  bridge: SupportedBridge
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

export type ExitToPrecompileTx = {
  nep141Address: string
  amount: string | ethers.BigNumber
  recipient: string
  options?: {
    symbol?: string
    decimals?: number
    sender?: string
    auroraChainId?: number
    provider?: ethers.providers.JsonRpcProvider
    auroraErc20Abi?: string
    auroraErc20Address?: string
    signer?: ethers.Signer
    nearAccount?: Account
    nearProvider?: najProviders.Provider
    auroraEvmAccount?: string
    unwrapWNear?: boolean
  }
}
