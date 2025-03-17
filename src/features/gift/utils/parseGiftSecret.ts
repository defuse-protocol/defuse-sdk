import { hex } from "@scure/base"
import { Err, Ok, type Result } from "@thames/monads"
import bs58 from "bs58"
import { sign } from "tweetnacl"
import * as v from "valibot"
import { normalizeNEP413Key } from "./generateEscrowCredentials"

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
    const parseResult = v.safeParse(v.string(), secretKey)
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

export function deriveAccountId(secretKey: string): string {
  const normalizedSecretKey = normalizeNEP413Key(secretKey)
  const secretKeyBase58 = bs58.decode(normalizedSecretKey)
  const keyPair = sign.keyPair.fromSecretKey(secretKeyBase58)
  return hex.encode(keyPair.publicKey)
}
