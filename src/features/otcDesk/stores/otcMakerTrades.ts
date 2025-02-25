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
  removeTrade: (tradeId: string) => void
}

type Store = State & Actions

export const otcMakerTradesStore = create<Store>()(
  persist(
    (set) => ({
      trades: [],

      addTrade: (trade) => {
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
      name: "intents_sdk.otc_maker_trades",
      storage: createJSONStorage(() => localStorage),
    }
  )
)

export { otcMakerTradesStore as useOtcMakerTrades }
