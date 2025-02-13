import { ECDSASigValue } from "@peculiar/asn1-ecc"
import { AsnParser } from "@peculiar/asn1-schema"
import { base58 } from "@scure/base"
import type { CredentialKey, CurveType } from "../types/webAuthn"
import { concatUint8Arrays } from "./uint8Array"

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

/**
 * Gets the actual signature from AuthenticatorAssertionResponse#signature bytes
 */
export function extractRawSignature(
  signature_: ArrayBuffer,
  curveType: CurveType
): Uint8Array {
  const signature = new Uint8Array(signature_)

  switch (curveType) {
    case "ed25519":
      return signature

    case "p256": {
      // Refer to the WebAuthn specification for signature attestation types:
      // https://www.w3.org/TR/webauthn-3/#sctn-signature-attestation-types
      // For COSEAlgorithmIdentifier -7 (ES256) and other ECDSA-based algorithms,
      // the signature value MUST be encoded as an ASN.1 DER Ecdsa-Sig-Value.
      const parsedSignature = AsnParser.parse(signature, ECDSASigValue)
      let rBytes = new Uint8Array(parsedSignature.r)
      let sBytes = new Uint8Array(parsedSignature.s)
      if (shouldRemoveLeadingZero(rBytes)) {
        rBytes = rBytes.slice(1)
      }
      if (shouldRemoveLeadingZero(sBytes)) {
        sBytes = sBytes.slice(1)
      }
      return concatUint8Arrays([rBytes, sBytes])
    }

    default:
      curveType satisfies never
      throw new Error(`Unsupported curve type ${curveType}`)
  }
}

/**
 * Specific for DER encoding of ECDSA signature.
 * Shouldn't be used for other purposes.
 */
function shouldRemoveLeadingZero(bytes: Uint8Array): boolean {
  // biome-ignore lint/style/noNonNullAssertion: trust me bro
  return bytes[0] === 0x0 && (bytes[1]! & (1 << 7)) !== 0
}
