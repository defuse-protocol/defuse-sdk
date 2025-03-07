import * as v from "valibot"
import { describe, expect, it } from "vitest"
import { IntentSchema } from "./schemaIntents"

describe("IntentSchema", () => {
  it.each([
    {
      intent: "token_diff",
      diff: { "nep141:token": "100" },
    },
    {
      intent: "token_diff",
      diff: { "nep141:token": "100" },
      memo: "some plain text",
      referral: "foo-referral.near",
    },
  ])("valid token_diff", (intent) => {
    expect(() => v.parse(IntentSchema, intent)).not.toThrow()
  })

  it.each([
    {
      intent: "token_diff",
      diff: { token: "100" },
    },
    {
      intent: "token_diff",
      diff: { "nep141:invalid-token-": "100" },
    },
    {
      intent: "token_diff",
      diff: { "nep141:wrap.near": 100 },
    },
  ])("invalid token_diff", (intent) => {
    expect(() => v.parse(IntentSchema, intent)).toThrow()
  })
})
