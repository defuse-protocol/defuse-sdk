import { Err, Ok, type Result } from "@thames/monads"
import * as v from "valibot"

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
