/**
 * Values are PoA Bridge specific
 */
export enum BlockchainEnum {
  // todo: remove NEAR because it's not supported by the bridge
  NEAR = "near:mainnet",
  ETHEREUM = "eth:1",
  BASE = "eth:8453",
  ARBITRUM = "eth:42161",
  BITCOIN = "btc:mainnet",
  SOLANA = "sol:mainnet",
  DOGECOIN = "doge:mainnet",
  // todo: remove TURBOCHAIN because it's not supported by the bridge
  TURBOCHAIN = "eth:1313161567",
  // todo: remove AURORA because it's not supported by the bridge
  AURORA = "eth:1313161554",
  XRPLEDGER = "xrp:mainnet",
  ZCASH = "zec:mainnet",
  GNOSIS = "eth:100",
  BERACHAIN = "eth:80094",
  TRON = "tron:mainnet",
}
