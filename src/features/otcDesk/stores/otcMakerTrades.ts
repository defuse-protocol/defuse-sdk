import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { SignerCredentials } from "../../../core/formatters"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import {
  type DefuseUserId,
  userAddressToDefuseUserId,
} from "../../../utils/defuse"

type OtcMakerTrade = {
  tradeId: string
  updatedAt: number
  makerMultiPayload: MultiPayload
}

type State = {
  trades: Record<DefuseUserId, OtcMakerTrade[]>
}

type Actions = {
  addTrade: (
    trade: Omit<OtcMakerTrade, "updatedAt">,
    userId: DefuseUserId | SignerCredentials
  ) => void
  removeTrade: (
    tradeId: string,
    userId: DefuseUserId | SignerCredentials
  ) => void
}

type Store = State & Actions

export const otcMakerTradesStore = create<Store>()(
  persist(
    (set) => ({
      trades: {},

      addTrade: (trade, user) => {
        const userId =
          typeof user === "string"
            ? user
            : userAddressToDefuseUserId(user.credential, user.credentialType)

        set((state) => ({
          trades: {
            ...state.trades,
            [userId]: [
              ...(state.trades[userId] ?? []),
              { ...trade, updatedAt: Date.now() },
            ],
          },
        }))
      },

      removeTrade: (tradeId: string, user) => {
        const userId =
          typeof user === "string"
            ? user
            : userAddressToDefuseUserId(user.credential, user.credentialType)

        set((state) => ({
          trades: {
            ...state.trades,
            [userId]: (state.trades[userId] ?? []).filter(
              (trade) => trade.tradeId !== tradeId
            ),
          },
        }))
      },
    }),
    {
      name: "intents_sdk.otc_maker_trades",
      storage: createJSONStorage(() => localStorage),
    }
  )
)

export { otcMakerTradesStore as useOtcMakerTrades }
