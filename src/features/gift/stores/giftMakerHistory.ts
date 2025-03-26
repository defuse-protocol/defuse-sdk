import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { SignerCredentials } from "../../../core/formatters"
import { logger } from "../../../logger"
import {
  type DefuseUserId,
  userAddressToDefuseUserId,
} from "../../../utils/defuse"
import type { GiftInfo } from "../actors/shared/getGiftInfo"
import {
  type GiftData,
  deserializeGiftData,
  serializeGiftData,
} from "../utils/giftDataSerializer"
import { GIFT_STORAGE_NAME, indexedDBStorage } from "./indexedDBStorage"
import { localStorageHandler } from "./localStorageHandler"
import { sessionStorageHandler } from "./sessionStorageHandler"

export interface GiftMakerHistory extends GiftInfo {
  giftId: string
  intentHashes: string[]
  updatedAt: number
}

type State = {
  gifts: Record<DefuseUserId, GiftMakerHistory[]>
}

type Actions = {
  addGift: (
    gift: Omit<GiftMakerHistory, "updatedAt">,
    userId: DefuseUserId | SignerCredentials
  ) => void
  updateGift: (
    giftId: string,
    userId: DefuseUserId | SignerCredentials,
    intentHashes: string[]
  ) => void
  removeGift: (giftId: string, userId: DefuseUserId | SignerCredentials) => void
}

type Store = State & Actions

type StorageOperation<T> = {
  operation: () => T | Promise<T>
  storageName: string
  operationType: "fetch" | "set" | "update" | "remove"
}

async function executeStorageOperations<T>(
  operations: StorageOperation<T>[]
): Promise<(T | null)[]> {
  return Promise.all(
    operations.map(async ({ operation, storageName, operationType }) => {
      try {
        return await operation()
      } catch (error) {
        let action: string
        switch (operationType) {
          case "fetch":
            action = "fetch from"
            break
          case "set":
            action = "set data in"
            break
          case "update":
            action = "update data in"
            break
          case "remove":
            action = "remove data from"
            break
          default:
            action = "interact with"
        }
        logger.error(
          new Error(`Failed to ${action} ${storageName}`, { cause: error })
        )
        return null
      }
    })
  )
}

export const tripleStorage = {
  getItem: async (name: string) => {
    const [localData, sessionData, indexedData] =
      await executeStorageOperations([
        {
          operation: () => localStorageHandler.getItem(name),
          storageName: "localStorage",
          operationType: "fetch",
        },
        {
          operation: () => sessionStorageHandler.getItem(name),
          storageName: "sessionStorage",
          operationType: "fetch",
        },
        {
          operation: () => indexedDBStorage.getItem(name),
          storageName: "indexedDB",
          operationType: "fetch",
        },
      ])

    const rawData = localData || sessionData || indexedData
    if (!rawData) return null

    try {
      return deserializeGiftData(JSON.parse(rawData))
    } catch (error) {
      logger.error(
        new Error("Failed to parse/deserialize data", { cause: error })
      )
      return null
    }
  },

  setItem: async (name: string, value: GiftData) => {
    const stringValue = JSON.stringify(serializeGiftData(value))
    await executeStorageOperations([
      {
        operation: () => localStorageHandler.setItem(name, stringValue),
        storageName: "localStorage",
        operationType: "set",
      },
      {
        operation: () => sessionStorageHandler.setItem(name, stringValue),
        storageName: "sessionStorage",
        operationType: "set",
      },
      {
        operation: () => indexedDBStorage.setItem(name, stringValue),
        storageName: "indexedDB",
        operationType: "set",
      },
    ])
  },

  updateItem: async (name: string, value: GiftData) => {
    const stringValue = JSON.stringify(serializeGiftData(value))
    await executeStorageOperations([
      {
        operation: () => localStorageHandler.setItem(name, stringValue),
        storageName: "localStorage",
        operationType: "update",
      },
      {
        operation: () => sessionStorageHandler.setItem(name, stringValue),
        storageName: "sessionStorage",
        operationType: "update",
      },
      {
        operation: () => indexedDBStorage.setItem(name, stringValue),
        storageName: "indexedDB",
        operationType: "update",
      },
    ])
  },

  removeItem: async (name: string) => {
    await executeStorageOperations([
      {
        operation: () => localStorageHandler.removeItem(name),
        storageName: "localStorage",
        operationType: "remove",
      },
      {
        operation: () => sessionStorageHandler.removeItem(name),
        storageName: "sessionStorage",
        operationType: "remove",
      },
      {
        operation: () => indexedDBStorage.removeItem(name),
        storageName: "indexedDB",
        operationType: "remove",
      },
    ])
  },
}

function getUserId(user: DefuseUserId | SignerCredentials) {
  return typeof user === "string"
    ? user
    : userAddressToDefuseUserId(user.credential, user.credentialType)
}

export const giftMakerHistoryStore = create<Store>()(
  persist(
    (set) => ({
      gifts: {},

      addGift: (gift, user) => {
        const userId = getUserId(user)
        set((state) => ({
          gifts: {
            ...state.gifts,
            [userId]: [
              ...(state.gifts[userId] ?? []),
              {
                ...gift,
                updatedAt: Date.now(),
              },
            ],
          },
        }))
      },

      updateGift: (giftId, user, intentHashes) => {
        const userId = getUserId(user)
        set((state) => ({
          gifts: {
            ...state.gifts,
            [userId]: (state.gifts[userId] ?? []).map((g) =>
              g.giftId === giftId ? { ...g, intentHashes } : g
            ),
          },
        }))
      },

      removeGift: (giftId: string, user) => {
        const userId = getUserId(user)
        set((state) => ({
          gifts: {
            ...state.gifts,
            [userId]: (state.gifts[userId] ?? []).filter(
              (gift) => gift.giftId !== giftId
            ),
          },
        }))
      },
    }),
    {
      name: GIFT_STORAGE_NAME,
      storage: tripleStorage,
    }
  )
)

export { giftMakerHistoryStore as useGiftMakerHistory }
