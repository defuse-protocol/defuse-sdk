import { Err, Ok, type Result } from "@thames/monads"
import { z } from "zod"
import {
  type EscrowCredentials,
  parseEscrowCredentials,
} from "./generateEscrowCredentials"

export type GiftSecretError = { reason: "INVALID_SECRET_KEY" }

export type ParsedGiftSecret = {
  escrowCredentials: EscrowCredentials
  message: string
}

const GiftSecretSchema = z.object({
  secretKey: z.string(),
  message: z.string(),
})

export function parseGiftSecret(
  secretKey: string
): Result<ParsedGiftSecret, GiftSecretError> {
  try {
    const parseResult = GiftSecretSchema.safeParse(secretKey)
    if (!parseResult.success) {
      return Err({ reason: "INVALID_SECRET_KEY" })
    }

    const escrowCredentials = parseEscrowCredentials(parseResult.data.secretKey)
    const message = parseResult.data.message

    return Ok({
      escrowCredentials,
      message,
    })
  } catch {
    return Err({ reason: "INVALID_SECRET_KEY" })
  }
}
