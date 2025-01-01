import {
  type ActorRef,
  type Snapshot,
  assign,
  fromPromise,
  sendTo,
  setup,
} from "xstate"
import { logger } from "../../logger"
import {
  type IntentSettlementResult,
  waitForIntentSettlement,
} from "../../services/intentService"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../types/base"
import type { IntentDescription } from "./swapIntentMachine"

type ChildEvent = {
  type: "INTENT_SETTLED"
  data: {
    intentHash: string
    txHash: string
    tokenIn: BaseTokenInfo | UnifiedTokenInfo
    tokenOut: BaseTokenInfo | UnifiedTokenInfo
  }
}
type ParentActor = ActorRef<Snapshot<unknown>, ChildEvent>

export const intentStatusMachine = setup({
  types: {
    input: {} as {
      parentRef: ParentActor
      intentHash: string
      tokenIn: BaseTokenInfo | UnifiedTokenInfo
      tokenOut: BaseTokenInfo | UnifiedTokenInfo
      intentDescription: IntentDescription
    },
    context: {} as {
      parentRef: ParentActor
      intentHash: string
      tokenIn: BaseTokenInfo | UnifiedTokenInfo
      tokenOut: BaseTokenInfo | UnifiedTokenInfo
      txHash: string | null
      intentDescription: IntentDescription
    },
  },
  actions: {
    logError: (_, params: { error: unknown }) => {
      logger.error(params.error)
    },
    setSettlementResult: assign({
      txHash: (_, settlementResult: IntentSettlementResult) =>
        settlementResult.txHash,
    }),
  },
  actors: {
    checkIntentStatus: fromPromise(
      ({
        input,
        signal,
      }: {
        input: { intentHash: string }
        signal: AbortSignal
      }): Promise<IntentSettlementResult> =>
        waitForIntentSettlement(signal, input.intentHash)
    ),
  },
  guards: {
    isSettled: (_, settlementResult: IntentSettlementResult) =>
      settlementResult.status === "SETTLED",
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEsB2AXMGDK6CG6ArrAHQAOWEaUAxANoAMAuoqGQPazLrLuqsgAHogCMAFgBsJCQCYZDGQFYGigMwiJAdgCcEgDQgAnqIbaSikQ01WJFzQA5tMiQF8XBtJhz4ipAMYAFmB+ANbUNBB8YCRoAG7sIdGeWOi4BMQkgcFhqFAIcex+BLyojExlAhxcPHwCwgiKMvYk9oqKYqqOipoiMmIiBsYI9iIkqnLa4lr2qroybh4YKWm+mUGh4ZGoSajxiTFL3un+6zl5BUU1pcx0IixIIFXcJXWIjaMy6gwikx3WmoNRLoxt11DpGvYmmJ5u4QMkjqsshtcjQwAAnNHsNHkAA2BAAZliALYHLypHwZJFnfK7QrFPhlCoPJ5XV4IGSTEgMMHfEQ9bTctSA9nOEiaSSNVSKCQSSQSESKBZww7k44kdGYtE0ABKAFEACragCaTLYnGetQe9TEimkYgF9hmMk06jaimFqjEzU0zu6KgYDC9srcsNQ7AgcAE8NVvkq5tZVsQAFomiQnNzZo7OpoZbZhUnmo1nfYFPYOmIbfaldGVhkKKgqLk49UXomED8uToZbz5Z9VFLhZYZCQZOJIZ6bdMbdWVbWTtlqM2Lfw286pMpVD1VAwZpDdMKHC0A71xAwJLodNoZ2S5yRYIQ-H44PBmfHW6B6toRiQvWIrNpNxLBV9CMEwGDTCQSzLJx+ilL1r2WClSDDdAAH1YjwHFkAgJcEw-RBtB0H9pX9ewdHsWwxEHACR00Bw6P6SES0UewEIRDINSxXD3yERApVUcwVBlaFRw5ERPQ9L0xm0NpxE9TMfhDFwgA */
  id: "intentStatus",
  initial: "pending",
  context: ({ input }) => {
    return {
      parentRef: input.parentRef,
      intentHash: input.intentHash,
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut,
      txHash: null,
      intentDescription: input.intentDescription,
    }
  },
  states: {
    pending: {
      always: "checking",
    },
    checking: {
      invoke: {
        src: "checkIntentStatus",
        input: ({ context }) => ({ intentHash: context.intentHash }),
        onDone: [
          {
            target: "success",
            guard: {
              type: "isSettled",
              params: ({ event }) => event.output,
            },
            actions: {
              type: "setSettlementResult",
              params: ({ event }) => event.output,
            },
          },
          {
            target: "not_valid",
            reenter: true,
          },
        ],
        onError: {
          target: "error",
          actions: {
            type: "logError",
            params: ({ event }) => event,
          },
        },
      },
    },
    success: {
      type: "final",

      entry: sendTo(
        ({ context }) => context.parentRef,
        ({ context }) => {
          assert(context.txHash != null, "txHash is null")
          return {
            type: "INTENT_SETTLED" as const,
            data: {
              intentHash: context.intentHash,
              txHash: context.txHash,
              tokenIn: context.tokenIn,
              tokenOut: context.tokenOut,
            },
          }
        }
      ),
    },
    not_valid: {
      type: "final",
    },
    error: {
      on: {
        RETRY: "pending",
      },
    },
  },
})

function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}
