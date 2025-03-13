import { hex } from "@scure/base"
import { Err, Ok, type Result } from "@thames/monads"
import bs58 from "bs58"
import { sign } from "tweetnacl"
import { safeParse, string } from "valibot"
import {
  type EscrowCredentials,
  normalizeNEP413Key,
} from "./generateEscrowCredentials"

export type GiftSecret = {
  secretKey: string
}

export type GiftSecretError =
  | "SECRET_KEY_EMPTY"
  | "CANNOT_PARSE_SECRET_KEY"
  | "ACCOUNT_NOT_FOUND"

export function parseGiftSecret(
  secretKey: string
): Result<GiftSecret, GiftSecretError> {
  try {
    const parseResult = safeParse(string(), secretKey)
    if (!parseResult.success) {
      return Err("CANNOT_PARSE_SECRET_KEY")
    }

    return Ok({
      secretKey: parseResult.output,
    })
  } catch {
    return Err("ACCOUNT_NOT_FOUND")
  }
}

// This function should be updated if we start supporting different escrow accounts
export function deriveAccountId(secretKey: string): string {
  const normalizedSecretKey = normalizeNEP413Key(secretKey)
  const secretKeyBase58 = bs58.decode(normalizedSecretKey)
  const keyPair = sign.keyPair.fromSecretKey(secretKeyBase58)
  return hex.encode(keyPair.publicKey)
}

export function deriveSecretKey(
  escrowCredentials: EscrowCredentials,
  standard: "nep413"
): string {
  switch (standard) {
    case "nep413":
      return escrowCredentials.NEP413.secretKey
    default:
      standard satisfies never
      throw new Error("Invalid standard")
  }
}
