import { ECDSASigValue } from "@peculiar/asn1-ecc"
import { AsnParser } from "@peculiar/asn1-schema"
import { base58 } from "@scure/base"
import { base64urlnopad } from "@scure/base"
import { sign } from "tweetnacl"
import { logger } from "../logger"
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
 * Confirms that the assertion was signed by the authenticator with specified public key
 */
export async function verifyAuthenticatorAssertion(
  assertation: AuthenticatorAssertionResponse,
  { curveType, publicKey }: CredentialKey,
  challenge: Uint8Array
): Promise<boolean> {
  if (
    extractSignedChallenge(assertation) !== base64urlnopad.encode(challenge)
  ) {
    return false
  }

  const clientDataHash = await crypto.subtle.digest(
    "SHA-256",
    assertation.clientDataJSON
  )

  const signedBytes = concatUint8Arrays([
    new Uint8Array(assertation.authenticatorData),
    new Uint8Array(clientDataHash),
  ])

  const signature = extractRawSignature(assertation.signature, curveType)
  const publicKeyWebCryptoAPI = reconstructWebCryptoAPIPublicKey(
    publicKey,
    curveType
  )

  switch (curveType) {
    case "p256": {
      const key = await crypto.subtle.importKey(
        "raw",
        publicKeyWebCryptoAPI,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["verify"]
      )
      return crypto.subtle.verify(
        { name: "ECDSA", hash: { name: "SHA-256" } },
        key,
        signature,
        signedBytes
      )
    }

    case "ed25519": {
      return sign.detached.verify(signedBytes, signature, publicKeyWebCryptoAPI)
    }

    default:
      curveType satisfies never
      throw new Error(`Unsupported curve type ${curveType}`)
  }
}

/**
 * Makes a public key that can be used with WebCryptoAPI from the raw public key bytes
 */
function reconstructWebCryptoAPIPublicKey(
  publicKey: Uint8Array,
  curveType: CurveType
): Uint8Array {
  switch (curveType) {
    case "p256": {
      const x = publicKey.slice(0, 32)
      const y = publicKey.slice(32, 64)
      return concatUint8Arrays([new Uint8Array([0x04]), x, y])
    }

    case "ed25519":
      return publicKey

    default:
      curveType satisfies never
      throw new Error(`Unsupported curve type ${curveType}`)
  }
}

/**
 * Tries to determine the challenge that was signed by the authenticator
 */
function extractSignedChallenge(
  assertation: AuthenticatorAssertionResponse
): string | null {
  const clientDataJSON = new TextDecoder().decode(assertation.clientDataJSON)

  try {
    const clientData = JSON.parse(clientDataJSON)
    if (typeof clientData.challenge === "string") {
      return clientData.challenge
    }
  } catch {
    logger.error("Failed to parse clientDataJSON")
  }

  return null
}

/**
 * Gets the actual signature from AuthenticatorAssertionResponse#signature bytes
 */
export function extractRawSignature(
  attestationSignature_: ArrayBuffer | Uint8Array,
  curveType: CurveType
): Uint8Array {
  const attestationSignature = new Uint8Array(attestationSignature_)

  switch (curveType) {
    case "ed25519":
      return attestationSignature

    case "p256": {
      // Refer to the WebAuthn specification for signature attestation types:
      // https://www.w3.org/TR/webauthn-3/#sctn-signature-attestation-types
      // For COSEAlgorithmIdentifier -7 (ES256) and other ECDSA-based algorithms,
      // the signature value MUST be encoded as an ASN.1 DER Ecdsa-Sig-Value.
      const parsedSignature = AsnParser.parse(
        attestationSignature,
        ECDSASigValue
      )
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
