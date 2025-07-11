import { authHandleToIntentsUserId } from "src/utils/authIdentity"
import { isAddress } from "viem"
import { AuthMethod } from "../../../../../../types"
import type { SupportedChainName } from "../../../../../../types/base"
import { validateAddress } from "../../../../../../utils/validateAddress"
import { isNearIntentsNetwork } from "../../utils"

export function validateAddressSoft(
  address: string,
  chainName: SupportedChainName | "near_intents",
  userAddress: string,
  chainType: AuthMethod | undefined
): string | null {
  if (isNearIntentsNetwork(chainName)) {
    if (userAddress.toLowerCase() === address.toLowerCase()) {
      return "You cannot withdraw to your own address. Please enter a different recipient address."
    }
    if (chainType && chainType === AuthMethod.WebAuthn) {
      const internalUserAddress = authHandleToIntentsUserId(
        userAddress,
        chainType
      )
      if (internalUserAddress === address.toLowerCase()) {
        return "You cannot withdraw to your own address. Please enter a different recipient address."
      }
      return null
    }
    if (validateAddress(address, "near")) {
      return null
    }
    return "Please enter a valid address for the selected blockchain"
  }

  if (
    !isNearIntentsNetwork(chainName) &&
    (validateAddress(address, chainName as SupportedChainName) ||
      isNearEVMAddress(address, chainName as SupportedChainName))
  ) {
    return null
  }
  return "Please enter a valid address for the selected blockchain"
}

function isNearEVMAddress(
  address: string,
  chainName: SupportedChainName
): boolean {
  return chainName === "near" && isAddress(address)
}
