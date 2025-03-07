import * as v from "valibot"
import { NearAccountIdSchema, ToBigIntSchema } from "./schemaPrimitives"

// It doesn't implement all possible intents, just `token_diff`
export const IntentSchema = v.variant("intent", [
  v.object({
    intent: v.literal("token_diff"),
    diff: v.pipe(v.record(v.string(), ToBigIntSchema)),
    memo: v.optional(v.string()),
    referral: v.optional(NearAccountIdSchema),
  }),
])
