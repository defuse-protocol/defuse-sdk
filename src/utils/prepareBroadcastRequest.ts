import { base58, base64 } from "@scure/base"
import { hexToBytes } from "viem"
import type {
  Params,
  PublishIntentRequest,
} from "../services/solverRelayHttpClient/types"
import type { WalletSignatureResult } from "../types"

export function prepareSwapSignedData(
  signature: WalletSignatureResult
): Params<PublishIntentRequest>["signed_data"] {
  switch (signature.type) {
    case "NEP413": {
      return {
        standard: "nep413",
        payload: {
          message: signature.signedData.message,
          nonce: base64.encode(signature.signedData.nonce),
          recipient: signature.signedData.recipient,
          callbackUrl: signature.signedData.callbackUrl,
        },
        public_key: signature.signatureData.publicKey, // publicKey is already in the correct format
        signature: transformNEP141Signature(signature.signatureData.signature),
      }
    }
    case "ERC191": {
      return {
        standard: "erc191",
        payload: signature.signedData.message,
        signature: transformERC191Signature(signature.signatureData),
      }
    }
    default:
      throw new Error("exhaustive check failed")
  }
}

function transformNEP141Signature(signature: string) {
  const encoded = base58.encode(base64.decode(signature))
  return `ed25519:${encoded}`
}

function transformERC191Signature(signature: string) {
  const bytes = hexToBytes(signature as "0x${string}")
  return `secp256k1:${base58.encode(bytes)}`
}

function normalizeERC191Signature(signature: string): string {
  // Get `v` from the last two characters
  let v = Number.parseInt(signature.slice(-2), 16)

  // // Normalize `v` to be either 0 or 1
  v = toRecoveryBit(v)

  // Convert `v` back to hex
  const vHex = v.toString(16).padStart(2, "0")

  // Reconstruct the full signature with the adjusted `v`
  return signature.slice(0, -2) + vHex
}

// Copy from viem/utils/signature/recoverPublicKey.ts
function toRecoveryBit(yParityOrV: number) {
  if (yParityOrV === 0 || yParityOrV === 1) return yParityOrV
  if (yParityOrV === 27) return 0
  if (yParityOrV === 28) return 1
  throw new Error("Invalid yParityOrV value")
}
