import type { KeyPairString } from "near-api-js/lib/utils"
import type { BaseTokenInfo } from "src/types/base"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { SignerCredentials } from "../../../core/formatters"
import { logger } from "../../../logger"
import type { DefuseUserId } from "../../../utils/defuse"
import {} from "../utils/schemaStorage"
import { GIFT_STORAGE_NAME } from "./indexedDBStorage"
import { migrateGiftStorage } from "./migrations"
import {
  type StorageOperationResult,
  getUserId,
  tripleStorage,
} from "./storageOperations"

export type GiftStatus = "preparing" | "sent"

export interface GiftMakerHistory {
  giftId: string
  giftStatus: GiftStatus
  tokenDiff: Record<BaseTokenInfo["defuseAssetId"], bigint>
  tokenId: string
  secretKey: KeyPairString
  accountId: string
  message: string
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
    intentHashes: string[],
    giftStatus: GiftStatus
  ) => Promise<StorageOperationResult>
  removeGift: (
    giftId: string,
    userId: DefuseUserId | SignerCredentials
  ) => Promise<StorageOperationResult>
}

export type Store = State & Actions

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
      version: 2,
      migrate: migrateGiftStorage,
    }
  )
)

export { giftMakerHistoryStore as useGiftMakerHistory }
