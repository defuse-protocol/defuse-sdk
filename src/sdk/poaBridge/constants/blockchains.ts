/** @deprecated Use BlockchainNetworkId instead */
export enum BlockchainEnum {
  // todo: remove NEAR because it's not supported by the bridge
  NEAR = "near:mainnet",
  ETHEREUM = "eth:1",
  BASE = "eth:8453",
  ARBITRUM = "eth:42161",
  BITCOIN = "btc:mainnet",
  SOLANA = "sol:mainnet",
  DOGECOIN = "doge:mainnet",
  XRPLEDGER = "xrp:mainnet",
  ZCASH = "zec:mainnet",
  GNOSIS = "eth:100",
  BERACHAIN = "eth:80094",
  TRON = "tron:mainnet",
  POLYGON = "eth:137",
  BSC = "eth:56",
  // todo: remove BELOW because they're not supported by the bridge
  TURBOCHAIN = "eth:1313161567",
  TUXAPPCHAIN = "eth:1313161573",
  VERTEX = "eth:1313161587",
  OPTIMA = "eth:1313161569",
  COINEASY = "eth:1313161752",
  AURORA = "eth:1313161554",
}

/**
 * Values are PoA Bridge specific
 * @see https://docs.near-intents.org/near-intents/market-makers/poa-bridge-api
 */
export const PoaBridgeBlockchainNetworkId = {
  NEAR: "near:mainnet",
  ETHEREUM: "eth:1",
  BASE: "eth:8453",
  ARBITRUM: "eth:42161",
  BITCOIN: "btc:mainnet",
  SOLANA: "sol:mainnet",
  DOGECOIN: "doge:mainnet",
  XRPLEDGER: "xrp:mainnet",
  ZCASH: "zec:mainnet",
  GNOSIS: "eth:100",
  BERACHAIN: "eth:80094",
  TRON: "tron:mainnet",
  POLYGON: "eth:137",
  BSC: "eth:56",
} as const

export const VirtualBlockchainNetworkId = {
  TURBOCHAIN: "eth:1313161567",
  TUXAPPCHAIN: "eth:1313161573",
  VERTEX: "eth:1313161587",
  OPTIMA: "eth:1313161569",
  COINEASY: "eth:1313161752",
  AURORA: "eth:1313161554",
} as const

export const BlockchainNetworkId = {
  ...PoaBridgeBlockchainNetworkId,
  ...VirtualBlockchainNetworkId,
} as const

export const WithdrawalBlockchainNetworkId = {
  ...PoaBridgeBlockchainNetworkId,
  ...VirtualBlockchainNetworkId,
  /* Hyperliquid is only available as a withdrawal destination */
  HYPERLIQUID: "hyperliquid:999",
} as const

export type BlockchainNetworkId =
  (typeof BlockchainNetworkId)[keyof typeof BlockchainNetworkId]

export type WithdrawalBlockchainNetworkId =
  (typeof WithdrawalBlockchainNetworkId)[keyof typeof WithdrawalBlockchainNetworkId]
