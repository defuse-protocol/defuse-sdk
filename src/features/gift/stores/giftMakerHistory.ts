import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { SignerCredentials } from "../../../core/formatters"
import { logger } from "../../../logger"
import {
  type DefuseUserId,
  userAddressToDefuseUserId,
} from "../../../utils/defuse"
import type { GiftInfo } from "../actors/shared/getGiftInfo"
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

type GiftData = {
  state: {
    gifts: Record<DefuseUserId, GiftMakerHistory[]>
  }
}

function serializeGiftData(gift: GiftMakerHistory) {
  return {
    ...gift,
    tokenDiff: Object.fromEntries(
      Object.entries(gift.tokenDiff).map(([key, value]) => [
        key,
        typeof value === "bigint" ? value.toString() : value,
      ])
    ),
  }
}

function deserializeGiftData(gift: GiftMakerHistory) {
  return {
    ...gift,
    tokenDiff: Object.fromEntries(
      Object.entries(gift.tokenDiff).map(([key, value]) => [
        key,
        typeof value === "string" ? BigInt(value) : value,
      ])
    ),
  }
}

function processGiftData(data: GiftData | null) {
  if (data?.state?.gifts) {
    return {
      ...data,
      state: {
        ...data.state,
        gifts: Object.fromEntries(
          Object.entries(data.state.gifts).map(([key, value]) => [
            key,
            value.map(deserializeGiftData),
          ])
        ),
      },
    }
  }
  return data
}

export const tripleStorage = {
  getItem: async (name: string) => {
    const localData = localStorageHandler.getItem(name)
    const sessionData = sessionStorageHandler.getItem(name)
    let indexedData = null
    try {
      indexedData = await indexedDBStorage.getItem(name)
    } catch (error) {
      logger.error(
        new Error("Failed to fetch data from IndexedDB", { cause: error })
      )
    }
    const data = localData || sessionData || indexedData
    return data ? processGiftData(JSON.parse(data)) : null
  },
  setItem: async (
    name: string,
    value: Record<DefuseUserId, GiftMakerHistory[]>
  ) => {
    const stringValue = JSON.stringify(value)
    localStorageHandler.setItem(name, stringValue)
    sessionStorageHandler.setItem(name, stringValue)
    try {
      await indexedDBStorage.setItem(name, stringValue)
    } catch (error) {
      logger.error(
        new Error("Failed to set data in IndexedDB", { cause: error })
      )
    }
  },
  updateItem: async (
    name: string,
    value: Record<DefuseUserId, GiftMakerHistory[]>
  ) => {
    const stringValue = JSON.stringify(value)
    localStorageHandler.setItem(name, stringValue)
    sessionStorageHandler.setItem(name, stringValue)
    try {
      await indexedDBStorage.setItem(name, stringValue)
    } catch (error) {
      logger.error(
        new Error("Failed to update data in IndexedDB", { cause: error })
      )
    }
  },
  removeItem: async (name: string) => {
    localStorageHandler.removeItem(name)
    sessionStorageHandler.removeItem(name)
    try {
      await indexedDBStorage.removeItem(name)
    } catch (error) {
      logger.error(
        new Error("Failed to remove data from IndexedDB", { cause: error })
      )
    }
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
            ].map(serializeGiftData),
          },
        }))
      },

      updateGift: (giftId, user, intentHashes) => {
        const userId = getUserId(user)
        set((state) => ({
          gifts: {
            ...state.gifts,
            [userId]: (state.gifts[userId] ?? [])
              .map((g) => (g.giftId === giftId ? { ...g, intentHashes } : g))
              .map(serializeGiftData),
          },
        }))
      },

      removeGift: (giftId: string, user) => {
        const userId = getUserId(user)

        set((state) => ({
          gifts: {
            ...state.gifts,
            [userId]: (state.gifts[userId] ?? [])
              .filter((gift) => gift.giftId !== giftId)
              .map(serializeGiftData),
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
