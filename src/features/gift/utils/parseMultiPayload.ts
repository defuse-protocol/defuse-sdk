import type { Intent, MultiPayload } from "src/types/defuse-contracts-types"
import { logger } from "../../../logger"
import { MultiPayloadDeepSchema } from "../../otcDesk/utils/schemaMultipayload"

type TransferIntentSubset = {
  intent: "transfer"
  receiver_id: string
  tokens: {
    [k: string]: string
  }
}

export function parseMultiPayloadTransferMessage(
  multiPayload: MultiPayload
): null | TransferIntentSubset {
  const result = MultiPayloadDeepSchema.safeParse(multiPayload)
  if (!result.success) {
    logger.error(result.error)
    return null
  }
  const standard = result.data.standard
  switch (standard) {
    case "nep413": {
      const intents = result.data.payload.message.intents as unknown as Intent[]
      if (intents.length === 0) {
        return null
      }
      const firstIntent = intents[0]
      if (firstIntent && isTransferIntent(firstIntent)) {
        return firstIntent
      }
      return null
    }
    case "erc191":
    case "raw_ed25519":
    case "webauthn": {
      const intents = result.data.payload.intents as unknown as Intent[]
      if (intents.length === 0) {
        return null
      }
      const firstIntent = intents[0]
      if (firstIntent && isTransferIntent(firstIntent)) {
        return firstIntent
      }
      return null
    }
    default:
      standard satisfies never
      throw new Error("Unsupported multi payload standard")
  }
}

function isTransferIntent(intent: Intent): intent is TransferIntentSubset {
  return (
    intent.intent === "transfer" &&
    "receiver_id" in intent &&
    "tokens" in intent
  )
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
