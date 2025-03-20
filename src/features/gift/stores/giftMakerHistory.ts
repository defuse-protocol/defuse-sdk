import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { SignerCredentials } from "../../../core/formatters"
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
  removeGift: (giftId: string, userId: DefuseUserId | SignerCredentials) => void
}

type Store = State & Actions

export const tripleStorage = {
  getItem: async (name: string) => {
    const localData = localStorageHandler.getItem(name)
    const sessionData = sessionStorageHandler.getItem(name)
    const indexedData = await indexedDBStorage.getItem(name)
    const data = localData || sessionData || indexedData
    return data ? JSON.parse(data) : null
  },
  setItem: async (
    name: string,
    value: Record<DefuseUserId, GiftMakerHistory[]>
  ) => {
    const stringValue = JSON.stringify(value)
    localStorageHandler.setItem(name, stringValue)
    sessionStorageHandler.setItem(name, stringValue)
    await indexedDBStorage.setItem(name, stringValue)
  },
  removeItem: async (name: string) => {
    localStorageHandler.removeItem(name)
    sessionStorageHandler.removeItem(name)
    await indexedDBStorage.removeItem(name)
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
        const stringifiedTokenDiff = Object.fromEntries(
          Object.entries(gift.tokenDiff).map(([key, value]) => [
            key,
            value.toString(),
          ])
        )

        set((state) => ({
          gifts: {
            ...state.gifts,
            [userId]: [
              ...(state.gifts[userId] ?? []),
              {
                ...gift,
                updatedAt: Date.now(),
                tokenDiff: stringifiedTokenDiff,
              },
            ],
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
