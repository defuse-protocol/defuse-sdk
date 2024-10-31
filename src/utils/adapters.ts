import { BlockchainEnum } from "src/types"

export const assetNetworkAdapter: Record<string, BlockchainEnum> = {
  near: BlockchainEnum.NEAR,
  eth: BlockchainEnum.ETHEREUM,
  base: BlockchainEnum.BASE,
  arbitrum: BlockchainEnum.ARBITRUM,
  bitcoin: BlockchainEnum.BITCOIN,
}
