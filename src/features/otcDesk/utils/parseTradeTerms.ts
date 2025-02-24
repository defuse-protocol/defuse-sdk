import { Err, Ok, type Result } from "@thames/monads"
import * as v from "valibot"
import { logger } from "../../../logger"
import type { BaseTokenInfo } from "../../../types/base"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import type { DefuseUserId } from "../../../utils/defuse"

export type TradeTerms = {
  userId: DefuseUserId
  tokenDiff: Record<BaseTokenInfo["defuseAssetId"], bigint>
  deadline: string
  nonceBase64: string
  multiPayload: MultiPayload
}

export function parseTradeTerms(
  multiPayloadPlain: MultiPayload | object | string
): Result<TradeTerms, string> {
  const parseResult = v.safeParse(MultiPayloadPlainSchema, multiPayloadPlain)
  if (!parseResult.success) {
    logger.verbose("Couldn't parse multipayload", {
      multiPayloadPlain,
      issues: parseResult.issues,
    })
    return Err("CANNOT_PARSE_MULTIPAYLOAD")
  }
  const multiPayload = parseResult.output

  return getPlainPayload(multiPayload).andThen(
    (payloadPlain): Result<TradeTerms, string> => {
      const payloadParseResult = v.safeParse(PayloadPlainSchema, payloadPlain)
      if (!payloadParseResult.success) {
        logger.verbose("Couldn't parse payload", {
          payloadPlain,
          issues: payloadParseResult,
        })
        return Err("CANNOT_PARSE_PAYLOAD")
      }
      const payload = payloadParseResult.output

      const intent = payload.intents.find(
        (intent) => intent.intent === "token_diff"
      )

      if (intent === undefined) {
        return Err("NO_TOKEN_DIFF_INTENT")
      }

      const nonce =
        multiPayload.standard === "nep413"
          ? multiPayload.payload.nonce
          : "nonce" in payload
            ? payload.nonce
            : null

      if (nonce == null) {
        return Err("PAYLOAD_HAS_NO_NONCE")
      }

      return Ok({
        userId: payload.signer_id,
        tokenDiff: intent.diff,
        deadline: payload.deadline,
        nonceBase64: nonce,
        multiPayload,
      })
    }
  )
}

const BigIntSchema = v.pipe(
  v.string(),
  v.transform((a) => BigInt(a))
)

// It doesn't implement all possible intents, just `token_diff`
const IntentSchema = v.variant("intent", [
  v.object({
    intent: v.literal("token_diff"),
    diff: v.pipe(v.record(v.string(), BigIntSchema)),
    memo: v.optional(v.string()),
    referral: v.optional(v.string()),
  }),
])

const DeadlineSchema = v.pipe(v.string(), v.isoTimestamp())

const PayloadSchema = v.object({
  deadline: DeadlineSchema,
  nonce: v.string(), // todo: add base64 validation?
  signer_id: v.pipe(
    v.string(),
    // todo: add DefuseUserId validation?
    v.transform((a): DefuseUserId => a as DefuseUserId)
  ),
  verifying_contract: v.string(), // todo: add contract address validation?
  intents: v.array(IntentSchema),
})

const NEP413PayloadSchema = v.object({
  deadline: DeadlineSchema,
  signer_id: v.pipe(
    v.string(),
    // todo: add DefuseUserId validation?
    v.transform((a): DefuseUserId => a as DefuseUserId)
  ),
  intents: v.array(IntentSchema),
})

const PayloadPlainSchema = v.pipe(
  v.string(),
  v.transform((a) => {
    try {
      return JSON.parse(a)
    } catch {
      return null
    }
  }),
  v.union([PayloadSchema, NEP413PayloadSchema])
)

const MultiPayloadSchema = v.variant("standard", [
  v.object({
    standard: v.literal("nep413"),
    payload: v.object({
      message: v.string(),
      nonce: v.string(),
      recipient: v.string(),
      callbackUrl: v.optional(v.string()),
    }),
    signature: v.string(),
    public_key: v.string(),
  }),
  v.object({
    standard: v.literal("erc191"),
    payload: v.string(),
    signature: v.string(),
  }),
  v.object({
    standard: v.literal("raw_ed25519"),
    payload: v.string(),
    signature: v.string(),
    public_key: v.string(),
  }),
  v.object({
    standard: v.literal("webauthn"),
    payload: v.string(),
    signature: v.string(),
    public_key: v.string(),
    authenticator_data: v.string(),
    client_data_json: v.string(),
  }),
])

const MultiPayloadPlainSchema = v.pipe(
  v.union([v.string(), v.record(v.string(), v.unknown())]),
  v.transform((a) => {
    try {
      return typeof a === "string" ? JSON.parse(a) : a
    } catch {
      return null
    }
  }),
  MultiPayloadSchema
)

function getPlainPayload(payload: MultiPayload): Result<string, string> {
  const payloadStandard = payload.standard

  switch (payloadStandard) {
    case "nep413":
      return Ok(payload.payload.message)
    case "erc191":
    case "raw_ed25519":
    case "webauthn":
      return Ok(payload.payload)
    default:
      payloadStandard satisfies never
      return Err("UNSUPPORTED_PAYLOAD_STANDARD")
  }
}
