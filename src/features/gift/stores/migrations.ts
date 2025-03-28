import type { BaseTokenInfo, UnifiedTokenInfo } from "src/types/base"
import * as v from "valibot"
import { logger } from "../../../logger"
import { deriveTokenId } from "../utils/deriveToken"
import { GiftStorageSchema, GiftStorageSchemaV2 } from "../utils/schemaStorage"
import type { State } from "./giftMakerHistory"

export const migrateToV1 = (state: State) => {
  return {
    state: {
      gifts: Object.fromEntries(
        Object.entries(state.gifts).map(([userId, gifts]) => [
          userId,
          gifts.map((gift) => ({
            ...gift,
            tokenDiff: Object.fromEntries(
              Object.entries(gift.tokenDiff).map(([key, value]) => [
                key,
                typeof value === "string" ? BigInt(value) : value,
              ])
            ),
          })),
        ])
      ),
    },
  }
}

export const migrateToV2 = (
  validatedV1: v.InferOutput<typeof GiftStorageSchema>
) => {
  return {
    state: {
      gifts: Object.fromEntries(
        Object.entries(validatedV1.state.gifts).map(([userId, gifts]) => [
          userId,
          gifts.map((gift) => ({
            giftId: gift.giftId,
            giftStatus: gift.intentHashes.length > 0 ? "preparing" : "sent",
            intentHashes: gift.intentHashes,
            tokenDiff: gift.tokenDiff,
            tokenId: deriveTokenId(
              gift.token as BaseTokenInfo | UnifiedTokenInfo
            ),
            secretKey: gift.secretKey,
            accountId: gift.accountId,
            message: gift.message,
            updatedAt: gift.updatedAt,
          })),
        ])
      ),
    },
  }
}

export const migrateGiftStorage = (
  persistedState: unknown,
  version: number
): State => {
  if (version === 0) {
    try {
      const state = persistedState as State
      const migratedStateToV1 = migrateToV1(state)
      const validatedV0 = v.parse(GiftStorageSchema, migratedStateToV1)
      const migratedStateToV2 = migrateToV2(validatedV0)
      const validatedV2 = v.parse(GiftStorageSchemaV2, migratedStateToV2)
      return validatedV2.state as State
    } catch (error) {
      logger.error(
        new Error("Failed to migrate gift storage", { cause: error })
      )
      throw new Error("Failed to migrate gift storage. Please contact support.")
    }
  }
  if (version === 1) {
    try {
      const state = persistedState as State
      const validatedV1 = v.parse(GiftStorageSchema, {
        state: { gifts: state.gifts },
      })
      const migratedStateToV2 = migrateToV2(validatedV1)
      const validatedV2 = v.parse(GiftStorageSchemaV2, migratedStateToV2)
      return validatedV2.state as State
    } catch (error) {
      logger.error(
        new Error("Failed to migrate gift storage", { cause: error })
      )
      throw new Error("Failed to migrate gift storage. Please contact support.")
    }
  }
  return persistedState as State
}
