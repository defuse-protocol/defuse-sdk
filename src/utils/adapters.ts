import type { SupportedChainName } from "../types/base"
import { BlockchainEnum } from "../types/interfaces"

export const assetNetworkAdapter: Record<SupportedChainName, BlockchainEnum> = {
  near: BlockchainEnum.NEAR,
  eth: BlockchainEnum.ETHEREUM,
  base: BlockchainEnum.BASE,
  arbitrum: BlockchainEnum.ARBITRUM,
  bitcoin: BlockchainEnum.BITCOIN,
  solana: BlockchainEnum.SOLANA,
  dogecoin: BlockchainEnum.DOGECOIN,
  turbochain: BlockchainEnum.TURBOCHAIN,
  aurora: BlockchainEnum.AURORA,
  xrpledger: BlockchainEnum.XRPLEDGER,
  zcash: BlockchainEnum.ZCASH,
  gnosis: BlockchainEnum.GNOSIS,
  berachain: BlockchainEnum.BERACHAIN,
}

export const reverseAssetNetworkAdapter: Record<
  BlockchainEnum,
  SupportedChainName
> = {
  [BlockchainEnum.NEAR]: "near",
  [BlockchainEnum.ETHEREUM]: "eth",
  [BlockchainEnum.BASE]: "base",
  [BlockchainEnum.ARBITRUM]: "arbitrum",
  [BlockchainEnum.BITCOIN]: "bitcoin",
  [BlockchainEnum.SOLANA]: "solana",
  [BlockchainEnum.DOGECOIN]: "dogecoin",
  [BlockchainEnum.TURBOCHAIN]: "turbochain",
  [BlockchainEnum.AURORA]: "aurora",
  [BlockchainEnum.XRPLEDGER]: "xrpledger",
  [BlockchainEnum.ZCASH]: "zcash",
  [BlockchainEnum.GNOSIS]: "gnosis",
  [BlockchainEnum.BERACHAIN]: "berachain",
}
