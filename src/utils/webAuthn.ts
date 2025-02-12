import { base58 } from "@scure/base"
import type { CredentialKey } from "../types/webAuthn"

export function parsePublicKey(formattedPublicKey: string): CredentialKey {
  const curveType = getCurveType(formattedPublicKey)

  switch (curveType) {
    case "p256": {
      let publicKey: Uint8Array

      try {
        publicKey = base58.decode(formattedPublicKey.slice(5))
      } catch (err) {
        throw new Error("Public key is not base58 encoded", { cause: err })
      }

      if (publicKey.length !== 64) {
        throw new Error(
          `Invalid public key size for P-256 curve, it must be 64 bytes, but got ${publicKey.length} bytes`
        )
      }

      return { curveType, publicKey }
    }

    case "ed25519": {
      let publicKey: Uint8Array

      try {
        publicKey = base58.decode(formattedPublicKey.slice(8))
      } catch (err) {
        throw new Error("Public key is not base58 encoded", { cause: err })
      }

      if (publicKey.length !== 32) {
        throw new Error(
          `Invalid public key size for Ed25519 curve, it must be 32 bytes, but got ${publicKey.length} bytes`
        )
      }

      return { curveType, publicKey }
    }

    default:
      throw new Error(`Unsupported curve type ${curveType}`)
  }
}

function getCurveType(formattedPublicKey: string): string {
  const delim = formattedPublicKey.indexOf(":")
  if (delim === -1) {
    throw new Error("Invalid public key format")
  }
  return formattedPublicKey.slice(0, delim)
}
