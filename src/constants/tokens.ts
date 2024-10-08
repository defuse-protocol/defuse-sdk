import { INDEXER } from "../types"
import type { BaseTokenInfo } from "../types/base"

export const LIST_NETWORKS_TOKENS: BaseTokenInfo[] = [
  {
    defuseAssetId: "near:mainnet:wrap.near",
    chainId: "mainnet",
    address: "wrap.near",
    chainName: "NEAR",
    name: "Wrapped NEAR fungible token",
    symbol: "wNEAR",
    chainIcon: "/static/icons/network/near.svg",
    icon: "https://assets.coingecko.com/coins/images/10365/standard/near.jpg",
    decimals: 24,
    routes: [],
  },
  {
    defuseAssetId:
      "near:mainnet:aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near",
    chainId: "mainnet",
    address: "aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near",
    chainName: "NEAR",
    name: "Aurora",
    symbol: "AURORA",
    chainIcon: "/static/icons/network/near.svg",
    icon: "https://assets.coingecko.com/coins/images/20582/standard/aurora.jpeg?1696519989",
    decimals: 18,
    routes: [],
  },
  {
    defuseAssetId: "near:mainnet:usm.tkn.near",
    chainId: "mainnet",
    address: "usm.tkn.near",
    chainName: "NEAR",
    name: "USMeme",
    symbol: "USM",
    chainIcon: "/static/icons/network/near.svg",
    icon: "https://assets.coingecko.com/coins/images/38114/standard/usmeme.jpeg?1716536863",
    decimals: 18,
    routes: [],
  },
  {
    defuseAssetId:
      "near:mainnet:2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near",
    chainId: "mainnet",
    address: "2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near",
    chainName: "NEAR",
    name: "Wrapped BTC",
    symbol: "wBTC",
    chainIcon: "/static/icons/network/near.svg",
    icon: "https://assets.coingecko.com/coins/images/7598/standard/wrapped_bitcoin_wbtc.png",
    decimals: 18,
    routes: [],
  },
  {
    defuseAssetId: "near:mainnet:token.v2.ref-finance.near",
    chainId: "mainnet",
    address: "token.v2.ref-finance.near",
    chainName: "NEAR",
    name: "Ref Finance Token",
    symbol: "REF",
    chainIcon: "/static/icons/network/near.svg",
    icon: "https://assets.coingecko.com/coins/images/18279/standard/ref.png?1696517772",
    decimals: 18,
    routes: [],
  },
  {
    defuseAssetId: "near:mainnet:aurora",
    chainId: "mainnet",
    address: "aurora",
    chainName: "NEAR",
    name: "ETH",
    symbol: "ETH",
    chainIcon: "/static/icons/network/near.svg",
    icon: "https://assets.coingecko.com/coins/images/279/standard/ethereum.png",
    decimals: 18,
    routes: [],
  },
]

export const LIST_NATIVE_TOKENS: BaseTokenInfo[] = [
  {
    defuseAssetId: "near:mainnet:native",
    chainName: "NEAR",
    chainId: "1313161554",
    address: "native",
    name: "NEAR",
    symbol: "NEAR",
    chainIcon: "/static/icons/network/near.svg",
    icon: "https://assets.coingecko.com/coins/images/10365/standard/near.jpg?1696510367",
    decimals: 24,
    routes: ["wrap.near", "near:mainnet:wrap.near"],
  },
]

export const NEAR_TOKEN_META = {
  defuseAssetId: "near:mainnet:native",
  blockchain: "near",
  chainName: "NEAR",
  chainId: "1313161554",
  address: "native",
  name: "NEAR",
  symbol: "NEAR",
  chainIcon: "/static/icons/network/near.svg",
  icon: "https://assets.coingecko.com/coins/images/10365/standard/near.jpg?1696510367",
  decimals: 24,
  routes: ["wrap.near", "near:mainnet:wrap.near"],
}

export const W_NEAR_TOKEN_META = {
  defuseAssetId: "near:mainnet:wrap.near",
  blockchain: "near",
  chainId: "mainnet",
  address: "wrap.near",
  chainName: "NEAR",
  name: "Wrapped NEAR fungible token",
  symbol: "wNEAR",
  chainIcon: "/static/icons/network/near.svg",
  icon: "https://assets.coingecko.com/coins/images/10365/standard/near.jpg",
  decimals: 24,
  routes: [],
}

export const W_BASE_TOKEN_META = {
  defuseAssetId: "eth:8453:native",
  blockchain: "eth",
  chainId: "8453",
  address: "0x4200000000000000000000000000000000000006",
  chainName: "BASE",
  name: "Wrapped Ether",
  symbol: "WETH",
  chainIcon: "/static/icons/network/base.svg",
  icon: "https://assets.coingecko.com/coins/images/279/standard/ethereum.png",
  decimals: 18,
  routes: [],
}

export const CONTRACTS_REGISTER = {
  [INDEXER.INTENT_0]: "esufed.near",
  [INDEXER.INTENT_1]: "swap-defuse.near",
}
