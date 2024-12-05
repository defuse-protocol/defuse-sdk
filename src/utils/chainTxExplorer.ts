import type { SupportedChainName } from "src/types"

export function chainTxExplorer(blockchain: SupportedChainName): string {
  switch (blockchain) {
    case "near":
      return "https://nearblocks.io/txns/"
    case "eth":
      return "https://etherscan.io/tx/"
    case "base":
      return "https://basescan.org/tx/"
    case "arbitrum":
      return "https://arbiscan.io/tx/"
    case "turbochain":
      return "https://explorer.turbo.aurora.dev/tx/"
    case "bitcoin":
      return "https://blockchain.info/tx/"
    case "solana":
      return "https://solscan.io/tx/"
    case "dogecoin":
      return "https://dogechain.info/tx/"
    default:
      blockchain satisfies never
      return ""
  }
}
