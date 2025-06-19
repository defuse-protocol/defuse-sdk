import { base58, base64, base64urlnopad, hex } from "@scure/base"
import { z } from "zod"
import { AssertionError } from "../../../errors/assert"
import { findError } from "../../../utils/errors"
import { isLegitAccountId } from "../../../utils/near"
import { normalizeERC191Signature } from "../../../utils/prepareBroadcastRequest"
import { parseDefuseAssetId } from "../../../utils/tokenUtils"
import { normalizeSignatureS } from "../../../utils/webAuthn"

export const ToBigIntSchema = z.string().transform((a) => BigInt(a))

export const NearAccountIdSchema = z.string().refine(isLegitAccountId)

export const DeadlineSchema = z.string().datetime()

export const NonceSchema = createBytesSchema("", "base64", base64, 32)

export const TokenIdSchema = z.string().refine(
  (value) => {
    try {
      parseDefuseAssetId(value)
      return true
    } catch (err: unknown) {
      const e = findError(err, AssertionError)
      throw new Error(e ? e.message : "unknown error")
    }
  },
  { message: "Invalid token ID" }
)

export const PublicKeyED25519Schema = z
  .string()
  .startsWith("ed25519:")
  .transform((value) => {
    const key = value.slice("ed25519:".length)
    try {
      const bytes = base58.decode(key)
      if (bytes.length === 32) {
        return bytes
      }
      throw new Error(`Invalid length (32 bytes expected, got ${bytes.length})`)
    } catch {
      throw new Error("Invalid base58 encoding")
    }
  })

export const SignatureED25519Schema = z
  .string()
  .startsWith("ed25519:")
  .transform((value) => {
    const key = value.slice("ed25519:".length)
    try {
      const bytes = base58.decode(key)
      if (bytes.length === 64) {
        return bytes
      }
      throw new Error(`Invalid length (64 bytes expected, got ${bytes.length})`)
    } catch {
      throw new Error("Invalid base58 encoding")
    }
  })

export const SignatureSecp256k1Schema = z
  .string()
  .startsWith("secp256k1:")
  .transform((value) => {
    const key = value.slice("secp256k1:".length)
    try {
      const bytes = base58.decode(key)
      if (bytes.length !== 65) {
        throw new Error(
          `Invalid length (65 bytes expected, got ${bytes.length})`
        )
      }
      const signatureHex = hex.encode(bytes)
      const normalizedSignature = normalizeERC191Signature(signatureHex)
      if (signatureHex !== normalizedSignature) {
        throw new Error(
          "Signature is not normalized (recovery bit is expected to be 1 or 0)"
        )
      }
      return bytes
    } catch {
      throw new Error("Invalid base58 encoding")
    }
  })

export const SignatureP256Schema = z
  .string()
  .startsWith("p256:")
  .transform((value) => {
    const key = value.slice("p256:".length)
    try {
      const bytes = base58.decode(key)
      if (bytes.length === 64) {
        const sBytes = bytes.slice(32, 64)
        const sBytesNormalized = normalizeSignatureS(sBytes)
        if (hex.encode(sBytes) !== hex.encode(sBytesNormalized)) {
          throw new Error("Signature malleability issue (S byte must be low)")
        }
        return bytes
      }
      throw new Error(`Invalid length (64 bytes expected, got ${bytes.length})`)
    } catch {
      throw new Error("Invalid base58 encoding")
    }
  })

export const PublicKeyP256Schema = z
  .string()
  .startsWith("p256:")
  .transform((value) => {
    const key = value.slice("p256:".length)
    try {
      const bytes = base58.decode(key)
      if (bytes.length === 64) {
        return bytes
      }
      throw new Error(`Invalid length (64 bytes expected, got ${bytes.length})`)
    } catch {
      throw new Error("Invalid base58 encoding")
    }
  })

export const WebAuthnAuthenticatorData = z.string().refine(
  (value) => {
    try {
      return base64urlnopad.decode(value)
    } catch {
      throw new Error("Invalid base64 urlsafe nopad encoding")
    }
  },
  { message: "Invalid base64 urlsafe nopad encoding" }
)

export const WebAuthnClientDataJson = z.string().refine(
  (value) => {
    try {
      return new TextEncoder().encode(value)
    } catch {
      throw new Error("Invalid JSON encoding")
    }
  },
  { message: "Invalid JSON encoding" }
)

export function createBytesSchema(
  prefix: string,
  encodingName: string,
  bytesCoder: { decode: (val: string) => Uint8Array },
  length: number
) {
  return z
    .string()
    .startsWith(prefix)
    .transform((value) => {
      const key = value.slice(prefix.length)
      try {
        const bytes = bytesCoder.decode(key)
        if (bytes.length === length) {
          return bytes
        }
        throw new Error(
          `Invalid length (${length} bytes expected, got ${bytes.length})`
        )
      } catch {
        throw new Error(`Invalid ${encodingName} encoding`)
      }
    })
}
