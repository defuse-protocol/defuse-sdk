import { hex } from "@scure/base"
import { Err, Ok, type Result } from "@thames/monads"
import bs58 from "bs58"
import { sign } from "tweetnacl"
import * as v from "valibot"

export type GiftSecret = {
  secretKey: string
  userId: string
}

export function parseGiftSecret(secretKey: string): Result<GiftSecret, string> {
  if (secretKey.length === 0) {
    return Err("SECRET_KEY_EMPTY")
  }

  const parseResult = v.safeParse(SecretKeyPlainSchema, secretKey)
  if (!parseResult.success) {
    return Err("CANNOT_PARSE_SECRET_KEY")
  }

  return Ok({
    secretKey: parseResult.output,
    userId: deriveUserId(parseResult.output),
  })
}

const SecretKeyPlainSchema = v.string()

function deriveUserId(secretKeyBase58: string): string {
  const secretKey = bs58.decode(secretKeyBase58)
  const keyPair = sign.keyPair.fromSecretKey(secretKey)
  return hex.encode(keyPair.publicKey)
}
