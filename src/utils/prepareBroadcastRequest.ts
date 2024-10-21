import { base58, base64 } from "@scure/base"
import type { WalletMessage, WalletSignatureResult } from "../types"

export function prepareSwapSignedData(
  signature: WalletSignatureResult,
  walletMessage: WalletMessage
) /* todo: type should be inferred from API schema */ {
  switch (signature.type) {
    case "NEP141": {
      return {
        standard: "nep141",
        message: walletMessage.NEP141.message,
        nonce: base64.encode(walletMessage.NEP141.nonce),
        recipient: walletMessage.NEP141.recipient,
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
