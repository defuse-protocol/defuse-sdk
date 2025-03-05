import { hex } from "@scure/base"
import { Err, Ok, type Result } from "@thames/monads"
import bs58 from "bs58"
import { sign } from "tweetnacl"
import * as v from "valibot"
import { logger } from "../../../logger"

export type GiftSecret = {
  secretKey: string
  walletId: string
}

export function parseGiftSecret(secretKey: string): Result<GiftSecret, string> {
  const parseResult = v.safeParse(SecretKeyPlainSchema, secretKey)
  if (!parseResult.success) {
    // TODO: Probably, secret key should not be logged to Sentry for security reasons
    logger.verbose("Couldn't parse secret key", {
      secretKey,
      issues: parseResult.issues,
    })
    return Err("CANNOT_PARSE_SECRET_KEY")
  }

  return Ok({
    secretKey: parseResult.output,
    walletId: deriveWalletId(parseResult.output),
  })
}

const SecretKeyPlainSchema = v.string()

function deriveWalletId(secretKeyBase58: string): string {
  const secretKey = bs58.decode(secretKeyBase58)
  const keyPair = sign.keyPair.fromSecretKey(secretKey)
  return hex.encode(keyPair.publicKey)
}
