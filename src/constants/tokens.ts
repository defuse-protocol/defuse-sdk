import { INDEXER } from "../types"
import { BaseTokenInfo } from "../types/base"

const environment = process.env.ENVIRONMENT || "production"

const listNetworksTokensTestnet = [
  {
    defuseAssetId: "near:testnet:wrap.testnet",
    blockchain: "near",
    chainId: "testnet",
    address: "wrap.testnet",
    chainName: "NEAR",
    name: "Wrapped NEAR fungible token",
    symbol: "wNEAR",
    chainIcon: "/static/icons/network/near.svg",
    icon: "https://assets.coingecko.com/coins/images/18280/standard/EX4mrWMW_400x400.jpg?1696517773",
    decimals: 24,
    routes: [],
  },
  {
    defuseAssetId: "near:testnet:aurora.fakes.testnet",
    blockchain: "near",
    chainId: "testnet",
    address: "aurora.fakes.testnet",
    chainName: "NEAR",
    name: "Aurora",
    symbol: "AURORA",
    chainIcon: "/static/icons/network/near.svg",
    icon: "https://assets.coingecko.com/coins/images/20582/standard/aurora.jpeg?1696519989",
    decimals: 18,
    routes: [],
  },
  {
    defuseAssetId: "near:testnet:usdt.fakes.testnet",
    blockchain: "near",
    chainId: "testnet",
    address: "usdt.fakes.testnet",
    chainName: "NEAR",
    name: "Tether USD",
    symbol: "USDT.e",
    chainIcon: "/static/icons/network/near.svg",
    icon: "https://assets.coingecko.com/coins/images/325/standard/Tether.png?1696501661",
    decimals: 6,
    routes: [],
  },
  {
    defuseAssetId: "near:testnet:usdc.fakes.testnet",
    blockchain: "near",
    chainId: "testnet",
    address: "usdc.fakes.testnet",
    chainName: "NEAR",
    name: "USD Coin",
    symbol: "USDC",
    chainIcon: "/static/icons/network/near.svg",
    icon: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694",
    decimals: 6,
    routes: [],
  },
  {
    defuseAssetId: "near:testnet:wbtc.fakes.testnet",
    blockchain: "near",
    chainId: "testnet",
    address: "wbtc.fakes.testnet",
    chainName: "NEAR",
    name: "Wrapped BTC",
    symbol: "wBTC",
    chainIcon: "/static/icons/network/near.svg",
    icon: "https://assets.coingecko.com/coins/images/7598/standard/wrapped_bitcoin_wbtc.png?1696507857",
    decimals: 8,
    routes: [],
  },
  {
    defuseAssetId: "near:testnet:14b2bc0c-32bc-4ac0-8eab-416c700d7c3d.testnet",
    blockchain: "near",
    chainId: "testnet",
    address: "14b2bc0c-32bc-4ac0-8eab-416c700d7c3d.testnet",
    chainName: "NEAR",
    name: "Sweat",
    symbol: "SWEAT",
    chainIcon: "/static/icons/network/near.svg",
    icon: "https://assets.coingecko.com/coins/images/25057/standard/fhD9Xs16_400x400.jpg?1696524208",
    decimals: 18,
    routes: [],
  },
  {
    defuseAssetId: "near:testnet:ref.fakes.testnet",
    blockchain: "near",
    chainId: "testnet",
    address: "ref.fakes.testnet",
    chainName: "NEAR",
    name: "Ref Finance Token",
    symbol: "REF",
    chainIcon: "/static/icons/network/near.svg",
    icon: "https://assets.coingecko.com/coins/images/18279/standard/ref.png?1696517772",
    decimals: 18,
    routes: [],
  },
  {
    defuseAssetId: "near:testnet:blackdragon.fakes.testnet",
    blockchain: "near",
    chainId: "testnet",
    address: "blackdragon.fakes.testnet",
    chainName: "NEAR",
    name: "Black Dragon",
    symbol: "BLACKDRAGON",
    chainIcon: "/static/icons/network/near.svg",
    icon: "https://assets.coingecko.com/coins/images/35502/standard/Untitled-8.png?1709390396",
    decimals: 16,
    routes: [],
  },
  {
    defuseAssetId: "near:testnet:deltalonk.testnet",
    blockchain: "near",
    chainId: "testnet",
    address: "deltalonk.testnet",
    chainName: "NEAR",
    name: "LONK fungible token",
    symbol: "LONK",
    chainIcon: "/static/icons/network/near.svg",
    icon: "https://assets.coingecko.com/coins/images/36497/standard/Logo_Long_square.png?1717541650",
    decimals: 8,
    routes: [],
  },
]

const listNetworksTokensMainnet = [
  {
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
  },
  {
    defuseAssetId:
      "near:mainnet:aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near",
    blockchain: "near",
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
    blockchain: "near",
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
    blockchain: "near",
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
    blockchain: "near",
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
    blockchain: "near",
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

export const LIST_NETWORKS_TOKENS: BaseTokenInfo[] =
  environment === "development"
    ? listNetworksTokensTestnet
    : listNetworksTokensMainnet

const listNativeTokensTestnet = [
  {
    defuseAssetId: "near:testnet:native",
    blockchain: "near",
    chainName: "NEAR",
    chainId: "1313161554",
    address: "native",
    name: "NEAR",
    symbol: "NEAR",
    chainIcon: "/static/icons/network/near.svg",
    icon: "https://assets.coingecko.com/coins/images/10365/standard/near.jpg?1696510367",
    decimals: 24,
    routes: ["wrap.testnet"],
  },
]
const listNativeTokensMainnet = [
  {
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
  },
]

export const LIST_NATIVE_TOKENS: BaseTokenInfo[] =
  environment === "development"
    ? listNativeTokensTestnet
    : listNativeTokensMainnet

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

const CONTRACTS_MAINNET = {
  [INDEXER.INTENT_0]: "esufed.near",
  [INDEXER.INTENT_1]: "swap-defuse.near",
}

const CONTRACTS_TESTNET = {
  [INDEXER.INTENT_0]: "dintent.testnet",
  [INDEXER.INTENT_1]: "",
}

export const CONTRACTS_REGISTER =
  process.env.environment === "development"
    ? Object.assign({}, CONTRACTS_TESTNET)
    : Object.assign({}, CONTRACTS_MAINNET)
