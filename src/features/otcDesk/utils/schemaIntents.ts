import { z } from "zod"
import {
  NearAccountIdSchema,
  ToBigIntSchema,
  TokenIdSchema,
} from "./schemaPrimitives"

const IntentTokenDiffSchema = z.object({
  intent: z.literal("token_diff"),
  diff: z.record(TokenIdSchema, ToBigIntSchema),
  memo: z.string().optional(),
  referral: NearAccountIdSchema.optional(),
})

export type IntentTokenDiffSchemaOutput = z.infer<typeof IntentTokenDiffSchema>

const IntentNativeWithdrawSchema = z.object({
  intent: z.literal("native_withdraw"),
  receiver_id: NearAccountIdSchema,
  amount: ToBigIntSchema,
})

export type IntentNativeWithdrawSchemaOutput = z.infer<
  typeof IntentNativeWithdrawSchema
>

export const IntentSchema = z.discriminatedUnion("intent", [
  IntentTokenDiffSchema,
  IntentNativeWithdrawSchema,
])

export type IntentSchemaOutput = z.infer<typeof IntentSchema>
