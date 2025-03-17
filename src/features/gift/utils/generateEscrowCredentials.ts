import { base58, hex } from "@scure/base"
import type { SignerCredentials } from "src/core/formatters"
import { sign } from "tweetnacl"

export interface EscrowCredentials extends SignerCredentials {
  secretKey: string
}

export function generateEscrowCredentials(): EscrowCredentials {
  const keyPair = sign.keyPair()
  return {
    secretKey: transformNEP413Key(keyPair.secretKey),
    credential: hex.encode(keyPair.publicKey),
    credentialType: "near",
  }
}

function transformNEP413Key(key: Uint8Array): string {
  return `ed25519:${base58.encode(key)}`
}

export function normalizeNEP413Key(key: string): string {
  const value = key.slice("ed25519:".length)
  if (!value) {
    throw new Error("Invalid NEP413 key format")
  }
  return value
}
