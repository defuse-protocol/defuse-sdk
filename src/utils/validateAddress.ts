import { PublicKey } from "@solana/web3.js"
import type { SupportedChainName } from "../types"
import { isLegitAccountId } from "./near"

export function validateAddress(
  address: string,
  blockchain: SupportedChainName
): boolean {
  switch (blockchain) {
    case "near":
      return isLegitAccountId(address)
    case "eth":
    case "base":
    case "arbitrum":
    case "turbochain":
    case "aurora":
      // todo: Do we need to check checksum?
      return /^0x[a-fA-F0-9]{40}$/.test(address)
    case "bitcoin":
      return (
        /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address) ||
        /^3[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address) ||
        /^bc1[02-9ac-hj-np-z]{11,87}$/.test(address) ||
        /^bc1p[02-9ac-hj-np-z]{42,87}$/.test(address)
      )
    case "solana":
      try {
        return PublicKey.isOnCurve(address)
      } catch {
        return false
      }

    case "dogecoin":
      return /^[DA][1-9A-HJ-NP-Za-km-z]{25,33}$/.test(address)

    default:
      blockchain satisfies never
      return false
  }
}
