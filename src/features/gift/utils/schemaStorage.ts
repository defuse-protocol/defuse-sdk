import * as v from "valibot"

const FungibleTokenInfoSchema = v.object({
  defuseAssetId: v.string(),
  address: v.string(),
  symbol: v.string(),
  name: v.string(),
  decimals: v.number(),
  icon: v.string(),
  chainIcon: v.string(),
  chainName: v.string(),
  chainId: v.optional(v.string()),
  routes: v.optional(v.array(v.string())),
  bridge: v.string(),
})

const NativeTokenInfoSchema = v.object({
  defuseAssetId: v.string(),
  type: v.literal("native"),
  symbol: v.string(),
  name: v.string(),
  decimals: v.number(),
  icon: v.string(),
  chainIcon: v.string(),
  chainName: v.string(),
  chainId: v.optional(v.string()),
  routes: v.optional(v.array(v.string())),
  bridge: v.string(),
})

const BaseTokenInfoSchema = v.union([
  FungibleTokenInfoSchema,
  NativeTokenInfoSchema,
])

const UnifiedTokenInfoSchema = v.object({
  unifiedAssetId: v.string(),
  symbol: v.string(),
  name: v.string(),
  icon: v.string(),
  groupedTokens: v.array(BaseTokenInfoSchema),
})

const GiftMakerHistorySchema = v.object({
  giftId: v.string(),
  intentHashes: v.array(v.string()),
  tokenDiff: v.record(v.string(), v.bigint()),
  token: v.union([BaseTokenInfoSchema, UnifiedTokenInfoSchema]),
  secretKey: v.string(),
  accountId: v.string(),
  message: v.string(),
  updatedAt: v.number(),
})

const GiftMakerHistorySchemaV2 = v.object({
  giftId: v.string(),
  giftStatus: v.union([v.literal("preparing"), v.literal("sent")]),
  intentHashes: v.array(v.string()),
  tokenDiff: v.record(v.string(), v.bigint()),
  tokenId: v.string(),
  secretKey: v.string(),
  accountId: v.string(),
  message: v.string(),
  updatedAt: v.number(),
})

export const GiftStorageSchema = v.object({
  state: v.object({
    gifts: v.record(v.string(), v.array(GiftMakerHistorySchema)),
  }),
})

export const GiftStorageSchemaV2 = v.object({
  state: v.object({
    gifts: v.record(v.string(), v.array(GiftMakerHistorySchemaV2)),
  }),
})
