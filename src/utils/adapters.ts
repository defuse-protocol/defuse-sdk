import { BlockchainEnum, type SupportedChainName } from "../types"

export const assetNetworkAdapter: Record<SupportedChainName, BlockchainEnum> = {
  near: BlockchainEnum.NEAR,
  eth: BlockchainEnum.ETHEREUM,
  base: BlockchainEnum.BASE,
  arbitrum: BlockchainEnum.ARBITRUM,
  bitcoin: BlockchainEnum.BITCOIN,
  solana: BlockchainEnum.SOLANA,
  dogecoin: BlockchainEnum.DOGECOIN,
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
}
