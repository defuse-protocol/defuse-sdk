import { BlockchainEnum } from "src/types"

export const assetNetworkAdapter: Record<string, BlockchainEnum> = {
  near: BlockchainEnum.NEAR,
  eth: BlockchainEnum.ETHEREUM,
  base: BlockchainEnum.BASE,
  arbitrum: BlockchainEnum.ARBITRUM,
  bitcoin: BlockchainEnum.BITCOIN,
}

export const reverseAssetNetworkAdapter: Record<BlockchainEnum, string> = {
  [BlockchainEnum.NEAR]: "near",
  [BlockchainEnum.ETHEREUM]: "eth",
  [BlockchainEnum.BASE]: "base",
  [BlockchainEnum.ARBITRUM]: "arbitrum",
  [BlockchainEnum.BITCOIN]: "bitcoin",
}
