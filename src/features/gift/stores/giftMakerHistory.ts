import * as v from "valibot"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { SignerCredentials } from "../../../core/formatters"
import { logger } from "../../../logger"
import type { DefuseUserId } from "../../../utils/defuse"
import type { GiftInfo } from "../actors/shared/getGiftInfo"
import { GiftStorageSchema } from "../utils/schemaStorage"
import { GIFT_STORAGE_NAME } from "./indexedDBStorage"
import {
  type StorageOperationResult,
  getUserId,
  tripleStorage,
} from "./storageOperations"

export interface GiftMakerHistory extends GiftInfo {
  giftId: string
  intentHashes: string[]
  updatedAt: number
}

export type State = {
  gifts: Record<DefuseUserId, GiftMakerHistory[]>
}

export type GiftStorageState = {
  state: {
    gifts: Record<DefuseUserId, GiftMakerHistory[]>
  }
}

export type Actions = {
  addGift: (
    gift: Omit<GiftMakerHistory, "updatedAt">,
    userId: DefuseUserId | SignerCredentials
  ) => Promise<StorageOperationResult>
  updateGift: (
    giftId: string,
    userId: DefuseUserId | SignerCredentials,
    intentHashes: string[]
  ) => Promise<StorageOperationResult>
  removeGift: (
    giftId: string,
    userId: DefuseUserId | SignerCredentials
  ) => Promise<StorageOperationResult>
}

export type Store = State & Actions
export interface GiftMakerHistory extends GiftInfo {
  giftId: string
  intentHashes: string[]
  updatedAt: number
}

export const giftMakerHistoryStore = create<Store>()(
  persist(
    (set, get) => ({
      gifts: {},

      addGift: async (gift, user) => {
        const userId = getUserId(user)
        const newState = {
          gifts: {
            ...get().gifts,
            [userId]: [
              ...(get().gifts[userId] ?? []),
              {
                ...gift,
                updatedAt: Date.now(),
              },
            ],
          },
        }

        try {
          const result = await tripleStorage.setItem(GIFT_STORAGE_NAME, {
            state: newState,
          })
          if (result.tag === "err") {
            return result
          }
          set(newState)
          return result
        } catch (error) {
          logger.error(new Error("Failed to add gift", { cause: error }))
          return { tag: "err", reason: "ERR_UPDATE_ITEM_FAILED_IN_ALL_STORES" }
        }
      },

      updateGift: async (giftId, user, intentHashes) => {
        const userId = getUserId(user)
        const newState = {
          gifts: {
            ...get().gifts,
            [userId]: (get().gifts[userId] ?? []).map((g) =>
              g.giftId === giftId ? { ...g, intentHashes } : g
            ),
          },
        }

        try {
          const result = await tripleStorage.updateItem(GIFT_STORAGE_NAME, {
            state: newState,
          })
          if (result.tag === "err") {
            return result
          }
          set(newState)
          return result
        } catch (error) {
          logger.error(new Error("Failed to update gift", { cause: error }))
          return { tag: "err", reason: "ERR_UPDATE_ITEM_FAILED_IN_ALL_STORES" }
        }
      },

      removeGift: async (giftId, user) => {
        const userId = getUserId(user)
        const newState = {
          gifts: {
            ...get().gifts,
            [userId]: (get().gifts[userId] ?? []).filter(
              (gift) => gift.giftId !== giftId
            ),
          },
        }

        try {
          const result = await tripleStorage.removeItem(GIFT_STORAGE_NAME)
          if (result.tag === "err") {
            return result
          }
          set(newState)
          return result
        } catch (error) {
          logger.error(new Error("Failed to remove gift", { cause: error }))
          return { tag: "err", reason: "ERR_UPDATE_ITEM_FAILED_IN_ALL_STORES" }
        }
      },
    }),
    {
      name: GIFT_STORAGE_NAME,
      storage: tripleStorage,
      version: 1,
      migrate: (persistedState: unknown, version) => {
        if (version === 0) {
          try {
            const state = persistedState as State
            const migratedState = {
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

            const validated = v.parse(GiftStorageSchema, migratedState)
            return validated.state as State
          } catch (error) {
            logger.error(
              new Error("Failed to migrate gift storage", { cause: error })
            )
            throw new Error(
              "Failed to migrate gift storage. Please contact support."
            )
          }
        }
        return persistedState as State
      },
    }
  )
)

export { giftMakerHistoryStore as useGiftMakerHistory }
