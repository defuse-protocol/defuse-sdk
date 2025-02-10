import { base58 } from "@scure/base"

export type ParsedPublicKey = {
  curveType: CurveType
  publicKey: Uint8Array
}

type CurveType = "p256" | "ed25519"

export function parsePublicKey(formattedPublicKey: string): ParsedPublicKey {
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
      curveType satisfies never
      throw new Error(`Unsupported curve type ${curveType}`)
  }
}

export function getCurveType(publicKey: string): CurveType {
  if (publicKey.startsWith("p256:")) {
    return "p256"
  }

  if (publicKey.startsWith("ed25519:")) {
    return "ed25519"
  }

  throw new Error(`Unsupported public key type ${publicKey.slice(0, 5)}`)
}
