import { z } from "zod"

const FungibleTokenInfoSchema = z.object({
  type: z.literal("fungible"),
  defuseAssetId: z.string(),
  address: z.string(),
  symbol: z.string(),
  name: z.string(),
  decimals: z.number(),
  icon: z.string(),
  chainName: z.string(),
})

const NativeTokenInfoSchema = z.object({
  type: z.literal("native"),
  defuseAssetId: z.string(),
  symbol: z.string(),
  name: z.string(),
  decimals: z.number(),
  icon: z.string(),
  chainName: z.string(),
})

const BaseTokenInfoSchema = z.discriminatedUnion("type", [
  FungibleTokenInfoSchema,
  NativeTokenInfoSchema,
])

const UnifiedTokenInfoSchema = z.object({
  unifiedAssetId: z.string(),
  symbol: z.string(),
  name: z.string(),
  icon: z.string(),
  decimals: z.number().optional(),
  tags: z.array(z.string()).optional(),
  groupedTokens: z.array(BaseTokenInfoSchema),
})

const GiftMakerHistorySchemaV0 = z.object({
  giftId: z.string(),
  intentHashes: z.array(z.string()),
  tokenDiff: z.record(z.string(), z.string()),
  token: z.union([BaseTokenInfoSchema, UnifiedTokenInfoSchema]),
  secretKey: z.string(),
  accountId: z.string(),
  message: z.string(),
  updatedAt: z.number(),
})

const GiftMakerHistorySchemaV1 = z.object({
  giftId: z.string(),
  intentHashes: z.array(z.string()),
  tokenDiff: z.record(z.string(), z.bigint()),
  token: z.union([BaseTokenInfoSchema, UnifiedTokenInfoSchema]),
  secretKey: z.string(),
  accountId: z.string(),
  message: z.string(),
  updatedAt: z.number(),
})

const GiftMakerHistorySchemaV2 = z.object({
  tokenDiff: z.record(z.string(), z.string()),
  secretKey: z.string(),
  message: z.string(),
  intentHashes: z.array(z.string()),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const GiftStorageSchemaV0 = z.object({
  state: z.object({
    gifts: z.record(z.string(), z.array(GiftMakerHistorySchemaV0)),
  }),
})

export const GiftStorageSchemaV1 = z.object({
  state: z.object({
    gifts: z.record(z.string(), z.array(GiftMakerHistorySchemaV1)),
  }),
})

export const GiftStorageSchemaV2 = z.object({
  state: z.object({
    gifts: z.record(z.string(), z.array(GiftMakerHistorySchemaV2)),
  }),
})
