import { base58, base64 } from "@scure/base"
import type {
  Params,
  PublishIntentRequest,
} from "../services/solverRelayHttpClient/types"
import type { WalletMessage, WalletSignatureResult } from "../types"

export function prepareSwapSignedData(
  signature: WalletSignatureResult,
  _walletMessage: WalletMessage
): Params<PublishIntentRequest>["signed_data"] {
  switch (signature.type) {
    case "NEP413": {
      return {
        standard: "nep413",
        message: signature.signedData.message,
        nonce: base64.encode(signature.signedData.nonce),
        recipient: signature.signedData.recipient,
        callbackUrl: signature.signedData.callbackUrl,
        public_key: signature.signatureData.publicKey, // publicKey is already in the correct format
        signature: transformNEP141Signature(signature.signatureData.signature),
      }
    }
    case "EIP712": {
      throw new Error("EIP712 signature is not supported")
    }
    default:
      throw new Error("exhaustive check failed")
  }
}

function transformNEP141Signature(signature: string) {
  const encoded = base58.encode(base64.decode(signature))
  return `ed25519:${encoded}`
}
