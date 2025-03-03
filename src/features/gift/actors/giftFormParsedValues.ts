import { type SnapshotFromStore, createStore } from "@xstate/store"
import type {
  BaseTokenInfo,
  TokenValue,
  UnifiedTokenInfo,
} from "../../../types/base"
import { parseUnits } from "../../../utils/parse"
import { getTokenMaxDecimals } from "../../../utils/tokenUtils"
import type { GiftFormValuesState } from "./giftFormValuesStore"

type State = {
  tokenIn: null | BaseTokenInfo | UnifiedTokenInfo
  amountIn: null | TokenValue
}

export const createGiftFormParsedValuesStore = () =>
  createStore({
    context: {
      amountIn: null,
      tokenIn: null,
    } as State,
    emits: {
      valuesParsed: (_: { context: State }) => {},
    },
    on: {
      parseValues: (
        context,
        { formValues }: { formValues: GiftFormValuesState },
        enqueue
      ) => {
        const newContext = {
          ...context,
          amountIn: parseTokenValue(formValues.tokenIn, formValues.amountIn),
          tokenIn: formValues.tokenIn,
        }
        enqueue.emit.valuesParsed({ context: newContext })
        return newContext
      },
    },
  })

function parseTokenValue(
  token: null | BaseTokenInfo | UnifiedTokenInfo,
  value: string
): TokenValue | null {
  if (token == null) return null
  const decimals = getTokenMaxDecimals(token)
  try {
    return {
      amount: parseUnits(value, decimals),
      decimals,
    }
  } catch {
    return null
  }
}

export function allSetSelector(
  s: SnapshotFromStore<ReturnType<typeof createGiftFormParsedValuesStore>>
) {
  return s.context.tokenIn != null && s.context.amountIn != null
}
