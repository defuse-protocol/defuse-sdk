import { type SnapshotFromStore, createStore } from "@xstate/store"
import type {
  BaseTokenInfo,
  TokenValue,
  UnifiedTokenInfo,
} from "../../../types/base"
import { parseUnits } from "../../../utils/parse"
import { getTokenMaxDecimals } from "../../../utils/tokenUtils"
import type { GiftMakerFormValuesState } from "./giftMakerFormValuesStore"

type State = {
  tokenIn: null | BaseTokenInfo | UnifiedTokenInfo
  amountIn: null | TokenValue
  message: string
}

export const createGiftMakerFormParsedValuesStore = () =>
  createStore({
    context: {
      amountIn: null,
      tokenIn: null,
      message: "",
    } as State,
    emits: {
      valuesParsed: (_: { context: State }) => {},
    },
    on: {
      parseValues: (
        context,
        { formValues }: { formValues: GiftMakerFormValuesState },
        enqueue
      ) => {
        const newContext = {
          ...context,
          amountIn: parseTokenValue(formValues.tokenIn, formValues.amountIn),
          tokenIn: formValues.tokenIn,
          message: formValues.message,
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
  s: SnapshotFromStore<ReturnType<typeof createGiftMakerFormParsedValuesStore>>
) {
  return s.context.tokenIn != null && s.context.amountIn != null
}
