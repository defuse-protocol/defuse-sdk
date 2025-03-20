import type { MultiPayload } from "src/types/defuse-contracts-types"
import { safeParse } from "valibot"
import { logger } from "../../../logger"
import { MultiPayloadDeepSchema } from "../../otcDesk/utils/schemaMultipayload"

type TransferIntentSubset = {
  intent: "transfer"
  receiver_id: string
  tokens: {
    [k: string]: string
  }
  memo?: string | null
}

export function parseMultiPayloadTransferMessage(
  multiPayload: MultiPayload
): null | TransferIntentSubset {
  const result = safeParse(MultiPayloadDeepSchema, multiPayload)
  if (!result.success) {
    logger.error(result.issues)
    return null
  }
  if (result.output.standard !== "nep413") {
    logger.error(result.issues)
    return null
  }
  return result.output.payload.message
    .intents[0] as unknown as TransferIntentSubset
}

export function getTokenDiffFromTransferMessage(
  message: TransferIntentSubset
): null | Record<string, bigint> {
  if (message.intent !== "transfer") {
    return null
  }

  return Object.fromEntries(
    Object.entries(message.tokens).map(([token, amount]) => [
      token,
      BigInt(amount),
    ])
  )
}
