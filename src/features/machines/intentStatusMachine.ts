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
import type { IntentRef } from "./intentPoolMachine"

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
    } & IntentRef,
    context: {} as {
      parentRef: ParentActor
    } & IntentRef,
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
    isPublished: (_, input: { intentHash: string | null }) =>
      input.intentHash !== null,
    isSettled: (_, settlementResult: IntentSettlementResult) =>
      settlementResult.status === "SETTLED",
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEsB2AXMGDK6CG6ArrAHQAOWEaUAxANoAMAuoqGQPazLrLuqsgAHogCMIgOwkALAFZxADgDMIgGwyJiqQE4ZAGhABPUQykkZMhmPXyATIsU2p8gL7P9aTDnxFSAYwAWYL4A1tQ0EHxgJGgAbuzBUR5Y6LgExCQBQaGoUAix7L4EvKiMTKUCHFw8fALCCDI28iTy5lKK8jriIo4i+kYI8iIkDjZaIlIqCopaKjau7hjJqT4ZgSFhEaiJqHEJ0YteaX5r2bn5hdUlzHQiLEggldzFtYgNQ3YilmNt4gzifaIZsM5MpxDpGo0pHM3CAkocVpl1jkaGAAE6o9io8gAGwIADNMQBbfaeFLedKI055HYFIp8Urle6PS4vBCjIYMUGWCQiLScmSKAFsmwqEjiCYNRQyFQqCYqEQyeawg5ko4kNEY1E0ABKAFEACragCajLYnCeNXudUUJC0NlUaikbQkTvEciFmia0xkTnMDDU4zarhhqHYEDgAjhqp8FXNLKtiAAtFJJO0VHabAx5L9GvJZULE0101o8z6VNN7FnxEqo8t0hRUFQcrGqs8EwgGCR5Yo-mDulouiIpf9DMYbMMGNyB7zJtoayq68cstQWxb+O2bOJRRZFF0e0pbDMhQpmpPuuN-TMwVp56TFyRYIRfL44PAmXG26A6iWhk4pH8tF3eRLGlIVPk7GZgPkbQeilJxbyWclSFDdAAH0YjwbFkAgVd4y-RABy0aRpQYCxsxLR0wMAkhNwUcRxREWxgJkFwYVrJD1XRTFcM-IREClG0LGlWUbHtdlNA9Jxhh0dQ2jaH8b2DIA */
  id: "intentStatus",
  initial: "pending",
  context: ({ input }) => input,
  states: {
    pending: {
      always: {
        target: "checking",
        guard: {
          type: "isPublished",
          params: ({ context }) => ({
            intentHash: context.intentHash,
          }),
        },
      },
    },
    checking: {
      invoke: {
        src: "checkIntentStatus",
        input: ({ context }) => {
          assert(context.intentHash !== null, "intentHash is null")
          return { intentHash: context.intentHash }
        },
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
          assert(context.intentHash != null, "intentHash is null")
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
