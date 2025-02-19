import type { ChainType } from "../types/deposit"
import type { WalletSignatureResult } from "../types/swap"
import { prepareSwapSignedData } from "../utils/prepareBroadcastRequest"

export interface SignerCredentials {
  /** The credential (address or public key) that signed the intent */
  credential: string
  /** The type of credential used for signing */
  credentialType: ChainType
}

/**
 * Serializes a signed intent into the protocol's wire format
 * Transforms both signature and message data into the standardized
 * encoding expected by the Near Intents Protocol
 *
 * @param signature The signature result from the wallet
 * @param credentials The signer's credentials
 * @returns Intent data serialized in protocol wire format
 */
export function formatSignedIntent(
  signature: WalletSignatureResult,
  credentials: SignerCredentials
) {
  return prepareSwapSignedData(signature, {
    userAddress: credentials.credential,
    userChainType: credentials.credentialType,
  })
}
