import type { SupportedChainName } from "../types/base"
import { BlockchainEnum } from "../types/interfaces"

/**
 * Converts a BlockchainEnum value to its corresponding SupportedChainName
 * @param blockchain The BlockchainEnum value to convert
 * @returns The corresponding SupportedChainName
 */
export function blockchainToChainName(
  blockchain: BlockchainEnum
): SupportedChainName {
  // Split the blockchain string by ':' and take the first part
  const blockchainToChainMap: Record<BlockchainEnum, SupportedChainName> = {
    [BlockchainEnum.ETHEREUM]: "eth",
    [BlockchainEnum.NEAR]: "near",
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

  return blockchainToChainMap[blockchain]
}

/**
 * Converts a SupportedChainName to its corresponding BlockchainEnum value
 * @param chainName The SupportedChainName to convert
 * @returns The corresponding BlockchainEnum value
 */
export function chainNameToBlockchain(
  chainName: SupportedChainName
): BlockchainEnum {
  // Map each chain name to its corresponding BlockchainEnum value
  const chainToBlockchainMap: Record<SupportedChainName, BlockchainEnum> = {
    eth: BlockchainEnum.ETHEREUM,
    near: BlockchainEnum.NEAR,
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

  return chainToBlockchainMap[chainName]
}
