import * as v from "valibot"
import {
  DeadlineSchema,
  NearAccountIdSchema,
  NonceSchema,
  ToBigIntSchema,
} from "./schemaPrimitives"

// It doesn't implement all possible intents, just `token_diff`
const IntentSchema = v.variant("intent", [
  v.object({
    intent: v.literal("token_diff"),
    diff: v.pipe(v.record(v.string(), ToBigIntSchema)),
    memo: v.optional(v.string()),
    referral: v.optional(NearAccountIdSchema),
  }),
])

export const PayloadObjectSchema = v.object({
  deadline: DeadlineSchema,
  nonce: NonceSchema,
  signer_id: NearAccountIdSchema,
  verifying_contract: NearAccountIdSchema,
  intents: v.array(IntentSchema),
})

const NEP413PayloadObjectSchema = v.object({
  deadline: DeadlineSchema,
  signer_id: NearAccountIdSchema,
  intents: v.array(IntentSchema),
})

const NEP413PayloadStringSchema = v.pipe(
  v.string(),
  v.transform((a) => {
    try {
      return JSON.parse(a)
    } catch {
      return null
    }
  }),
  NEP413PayloadObjectSchema
)

export const GeneralPayloadStringSchema = v.pipe(
  v.string(),
  v.transform((a) => {
    try {
      return JSON.parse(a)
    } catch {
      return null
    }
  }),
  PayloadObjectSchema
)

export const PayloadStringSchema = v.union([
  GeneralPayloadStringSchema,
  NEP413PayloadStringSchema,
])

export const MultiPayloadSchema = v.variant("standard", [
  v.object({
    standard: v.literal("nep413"),
    payload: v.object({
      message: v.string(),
      nonce: NonceSchema,
      recipient: NearAccountIdSchema,
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

export const MultiPayloadDeepSchema = v.variant("standard", [
  v.object({
    standard: v.literal("nep413"),
    payload: v.object({
      message: NEP413PayloadStringSchema,
      nonce: NonceSchema,
      recipient: NearAccountIdSchema,
      callbackUrl: v.optional(v.string()),
    }),
    signature: v.string(),
    public_key: v.string(),
  }),
  v.object({
    standard: v.literal("erc191"),
    payload: GeneralPayloadStringSchema,
    signature: v.string(),
  }),
  v.object({
    standard: v.literal("raw_ed25519"),
    payload: GeneralPayloadStringSchema,
    signature: v.string(),
    public_key: v.string(),
  }),
  v.object({
    standard: v.literal("webauthn"),
    payload: GeneralPayloadStringSchema,
    signature: v.string(),
    public_key: v.string(),
    authenticator_data: v.string(),
    client_data_json: v.string(),
  }),
])

export const MultiPayloadPlainSchema = v.pipe(
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
