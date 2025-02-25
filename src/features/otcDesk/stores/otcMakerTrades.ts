import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { MultiPayload } from "../../../types/defuse-contracts-types"

type OtcMakerTrade = {
  tradeId: string
  updatedAt: number
  makerMultiPayload: MultiPayload
}

type State = {
  trades: OtcMakerTrade[]
}

type Actions = {
  addTrade: (trade: Omit<OtcMakerTrade, "updatedAt">) => void
}

type Store = State & Actions

export const otcTakerTradesStore = create<Store>()(
  persist(
    (set) => ({
      trades: [],

      addTrade: async (trade) => {
        set((state) => ({
          trades: [
            ...state.trades,
            {
              ...trade,
              updatedAt: Date.now(),
            },
          ],
        }))
      },

      removeTrade: (tradeId: string) => {
        set((state) => ({
          trades: state.trades.filter((trade) => trade.tradeId !== tradeId),
        }))
      },
    }),
    {
      name: "intents_sdk.otc_taker_trades",
      storage: createJSONStorage(() => localStorage),
    }
  )
)

export { otcTakerTradesStore as useOtcMakerTrades }
