import { createStore } from "@xstate/store"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"

export type GiftFormValuesState = {
  amountIn: string
  tokenIn: null | BaseTokenInfo | UnifiedTokenInfo
}

export const createGiftFormValuesStore = ({
  initialTokenIn,
}: {
  initialTokenIn: BaseTokenInfo | UnifiedTokenInfo
}) =>
  createStore({
    context: {
      amountIn: "",
      tokenIn: initialTokenIn,
    } satisfies GiftFormValuesState,
    emits: {
      changed: (_: { context: GiftFormValuesState }) => {},
    },
    on: {
      updateAmountIn: (context, event: { value: string }, enqueue) => {
        const newContext = {
          ...context,
          amountIn: event.value,
        }
        enqueue.emit.changed({ context: newContext })
        return newContext
      },
      updateTokenIn: (
        context,
        event: { value: BaseTokenInfo | UnifiedTokenInfo },
        enqueue
      ) => {
        const newContext = {
          ...context,
          tokenIn: event.value,
        }
        enqueue.emit.changed({ context: newContext })
        return newContext
      },
    },
  })
