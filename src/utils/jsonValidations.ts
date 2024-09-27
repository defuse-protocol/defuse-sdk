export const msgSchemaCreateIntent1CrossChain = {
  type: "object",
  properties: {
    type: { type: "string" },
    id: { type: "string", minLength: 1 },
    asset_out: {
      type: "object",
      properties: {
        type: { type: "string" },
        oracle: { type: "string", minLength: 1 },
        asset: { type: "string", minLength: 1 },
        amount: { type: "string", minLength: 1 },
        account: { type: "string", minLength: 1 },
      },
      required: ["type", "oracle", "asset", "amount", "account"],
    },
    lockup_until: {
      type: "object",
      properties: {
        block_number: { type: "integer" },
      },
      required: ["block_number"],
    },
    expiration: {
      type: "object",
      properties: {
        block_number: { type: "integer" },
      },
      required: ["block_number"],
    },
    referral: { type: "string" },
  },
  required: [
    "type",
    "id",
    "asset_out",
    "lockup_until",
    "expiration",
    "referral",
  ],
  additionalProperties: false,
}

export const msgSchemaCreateIntent1SingleChain = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["create"] },
    id: { type: "string" },
    asset_out: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["native", "nep141"] },
        token: { type: "string" },
        amount: { type: "string" },
        account: { type: "string", minLength: 1 },
      },
      required: ["type", "token", "amount", "account"],
    },
    lockup_until: {
      type: "object",
      properties: {
        block_number: { type: "integer", minimum: 0 },
      },
      required: ["block_number"],
    },
    expiration: {
      type: "object",
      properties: {
        block_number: { type: "integer", minimum: 0 },
      },
      required: ["block_number"],
    },
    referral: { type: "string" },
  },
  required: [
    "type",
    "id",
    "asset_out",
    "lockup_until",
    "expiration",
    "referral",
  ],
  additionalProperties: false,
}
