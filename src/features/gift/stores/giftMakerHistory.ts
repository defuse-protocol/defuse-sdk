import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { SignerCredentials } from "../../../core/formatters"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import {
  type DefuseUserId,
  userAddressToDefuseUserId,
} from "../../../utils/defuse"
import type { EscrowCredentials } from "../utils/generateEscrowCredentials"

export type GiftMakerHistory = {
  giftId: string
  updatedAt: number
  escrowCredentials: EscrowCredentials
  token: BaseTokenInfo | UnifiedTokenInfo
  amount: string
  decimals: number
  intentHashes: string[]
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

export const giftMakerHistoryStore = create<Store>()(
  persist(
    (set) => ({
      gifts: {},

      addGift: (gift, user) => {
        const userId =
          typeof user === "string"
            ? user
            : userAddressToDefuseUserId(user.credential, user.credentialType)

        set((state) => ({
          gifts: {
            ...state.gifts,
            [userId]: [
              ...(state.gifts[userId] ?? []),
              { ...gift, updatedAt: Date.now() },
            ],
          },
        }))
      },

      removeGift: (giftId: string, user) => {
        const userId =
          typeof user === "string"
            ? user
            : userAddressToDefuseUserId(user.credential, user.credentialType)

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
      name: "intents_sdk.gift_maker_gifts",
      storage: createJSONStorage(() => localStorage),
    }
  )
)

export { giftMakerHistoryStore as useGiftMakerHistory }
