import { AuthMethod } from "../../../../types/authHandle"
import type { SupportedChainName } from "../../../../types/base"

export function chainTypeSatisfiesChainName(
  chainType: AuthMethod | undefined,
  chainName: SupportedChainName
) {
  if (chainType == null) return false

  switch (true) {
    case chainType === AuthMethod.Near && chainName === "near":
    case chainType === AuthMethod.EVM && chainName === "eth":
    case chainType === AuthMethod.EVM && chainName === "arbitrum":
    case chainType === AuthMethod.EVM && chainName === "base":
    case chainType === AuthMethod.EVM && chainName === "turbochain":
    case chainType === AuthMethod.EVM && chainName === "aurora":
    case chainType === AuthMethod.EVM && chainName === "gnosis":
    case chainType === AuthMethod.EVM && chainName === "berachain":
    case chainType === AuthMethod.Solana && chainName === "solana":
      return true
  }

  return false
}

export function truncateUserAddress(hash: string) {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}
