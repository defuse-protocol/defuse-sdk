import { NetworkReference } from "../sdk/poaBridge/constants/blockchains"
import type { SupportedChainName } from "../types/base"

export const assetNetworkAdapter: Record<SupportedChainName, NetworkReference> =
  {
    near: NetworkReference.NEAR,
    eth: NetworkReference.ETHEREUM,
    base: NetworkReference.BASE,
    arbitrum: NetworkReference.ARBITRUM,
    bitcoin: NetworkReference.BITCOIN,
    solana: NetworkReference.SOLANA,
    dogecoin: NetworkReference.DOGECOIN,
    turbochain: NetworkReference.TURBOCHAIN,
    aurora: NetworkReference.AURORA,
    xrpledger: NetworkReference.XRPLEDGER,
    zcash: NetworkReference.ZCASH,
    gnosis: NetworkReference.GNOSIS,
    berachain: NetworkReference.BERACHAIN,
    tron: NetworkReference.TRON,
    tuxappchain: NetworkReference.TUXAPPCHAIN,
    vertex: NetworkReference.VERTEX,
    optima: NetworkReference.OPTIMA,
    coineasy: NetworkReference.COINEASY,
    polygon: NetworkReference.POLYGON,
    bsc: NetworkReference.BSC,
    hyperliquid: NetworkReference.HYPERLIQUID,
  }

export const reverseAssetNetworkAdapter: Record<
  NetworkReference,
  SupportedChainName
> = {
  [NetworkReference.NEAR]: "near",
  [NetworkReference.ETHEREUM]: "eth",
  [NetworkReference.BASE]: "base",
  [NetworkReference.ARBITRUM]: "arbitrum",
  [NetworkReference.BITCOIN]: "bitcoin",
  [NetworkReference.SOLANA]: "solana",
  [NetworkReference.DOGECOIN]: "dogecoin",
  [NetworkReference.TURBOCHAIN]: "turbochain",
  [NetworkReference.AURORA]: "aurora",
  [NetworkReference.XRPLEDGER]: "xrpledger",
  [NetworkReference.ZCASH]: "zcash",
  [NetworkReference.GNOSIS]: "gnosis",
  [NetworkReference.BERACHAIN]: "berachain",
  [NetworkReference.TRON]: "tron",
  [NetworkReference.TUXAPPCHAIN]: "tuxappchain",
  [NetworkReference.VERTEX]: "vertex",
  [NetworkReference.OPTIMA]: "optima",
  [NetworkReference.COINEASY]: "coineasy",
  [NetworkReference.POLYGON]: "polygon",
  [NetworkReference.BSC]: "bsc",
  [NetworkReference.HYPERLIQUID]: "hyperliquid",
}
