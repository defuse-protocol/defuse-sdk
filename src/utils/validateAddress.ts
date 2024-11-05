import { isLegitAccountId } from "./near"

export function validateAddress(address: string, blockchain: string): boolean {
  switch (blockchain) {
    case "near":
      return isLegitAccountId(address)
    case "eth":
    case "base":
    case "arbitrum":
      // todo: Do we need to check checksum?
      return /^0x[a-fA-F0-9]{40}$/.test(address)
    case "bitcoin":
      return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)
    default:
      return false
  }
}
