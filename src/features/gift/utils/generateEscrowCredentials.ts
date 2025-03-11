import { base58, hex } from "@scure/base"
import { sign } from "tweetnacl"

export type EscrowCredentials = {
  NEP413: {
    standard: "nep413"
    secretKey: string
    userId: string
  }
}

export function generateEscrowCredentials(): EscrowCredentials {
  const keyPair = sign.keyPair()
  return {
    NEP413: {
      standard: "nep413",
      secretKey: transformNEP413Key(keyPair.secretKey),
      userId: hex.encode(keyPair.publicKey),
    },
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
