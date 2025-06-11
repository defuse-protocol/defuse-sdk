import { isAddress } from "viem"
import type { SupportedChainName } from "../../../../../../types/base"
import { validateAddress } from "../../../../../../utils/validateAddress"

export function validateAddressSoft(
  address: string,
  chainName: SupportedChainName
): boolean {
  return (
    validateAddress(address, chainName) || isNearEVMAddress(address, chainName)
  )
}

function isNearEVMAddress(
  address: string,
  chainName: SupportedChainName
): boolean {
  return chainName === "near" && isAddress(address)
}
