import type { BaseTokenInfo, UnifiedTokenInfo } from "src/types/base"
import * as v from "valibot"
import { logger } from "../../../logger"
import { deserialize } from "../../../utils/deserialize"
import { serialize } from "../../../utils/serialize"
import { deriveTokenId } from "../utils/deriveToken"
import {
  GiftStorageSchemaV1,
  GiftStorageSchemaV2,
} from "../utils/schemaStorage"
import type { State } from "./giftMakerHistory"

export const migrateV0ToV1 = (state: State) => {
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
                {
                  __type: "bigint",
                  value: typeof value === "string" ? value : value.toString(),
                },
              ])
            ),
          })),
        ])
      ),
    },
  }
}

export const migrateV1ToV2 = (
  validatedV1: v.InferOutput<typeof GiftStorageSchemaV1>
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
  if (version === 1) {
    try {
      const state = persistedState as State
      const migratedStateToV1 = migrateV0ToV1(state)
      const validatedV1 = v.parse(GiftStorageSchemaV1, migratedStateToV1)
      const migratedStateToV2 = migrateV1ToV2(validatedV1)
      const validatedV2 = v.parse(GiftStorageSchemaV2, migratedStateToV2)
      return deserialize(serialize(validatedV2.state)) as State
    } catch (error) {
      logger.error(
        new Error("Failed to migrate gift storage", { cause: error })
      )
      throw new Error("Failed to migrate gift storage. Please contact support.")
    }
  }
  if (version === 2) {
    try {
      const state = persistedState as State
      const validatedV1 = v.parse(GiftStorageSchemaV1, {
        state: { gifts: state.gifts },
      })
      const migratedStateToV2 = migrateV1ToV2(validatedV1)
      const validatedV2 = v.parse(GiftStorageSchemaV2, migratedStateToV2)
      return deserialize(serialize(validatedV2.state)) as State
    } catch (error) {
      logger.error(
        new Error("Failed to migrate gift storage", { cause: error })
      )
      throw new Error("Failed to migrate gift storage. Please contact support.")
    }
  }
  return persistedState as State
}
