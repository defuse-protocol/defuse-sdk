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
import type { IntentDescription } from "./intentSignMachine"

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
      intentHash: string | null
      tokenIn: BaseTokenInfo | UnifiedTokenInfo
      tokenOut: BaseTokenInfo | UnifiedTokenInfo
      intentDescription: IntentDescription
    },
    context: {} as {
      parentRef: ParentActor
      intentHash: string | null
      tokenIn: BaseTokenInfo | UnifiedTokenInfo
      tokenOut: BaseTokenInfo | UnifiedTokenInfo
      txHash: string | null
      intentDescription: IntentDescription
    },
    events: {} as
      | {
          type: "APPLY_INTENT_HASH"
          params: {
            intentHash: string
          }
        }
      | {
          type: "RETRY"
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
    isReadyToCheck: ({ context }) => context.intentHash != null,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEsB2AXMGDK6CG6ArrAMQCCAChQDICaA+gJIByAKgKJv0ASZ23AbQAMAXUSgADgHtYydMimpxIAB6IATAA51AOgCMAZiF6A7AE4ArABY9VkxfUAaEAE9EAWj3qTO6+oBs6lZCVt7+Vv4mAL5RzmiYOPhEsDoSWBBoUCTCYkgg0rLyispqCJpmOsYR-oFmZgYGFuXObgh6Ib4WVQFGQuoGVjFxGFjouATEOgDGABZgUwDWmSQQimA6aABuUgvr8aPjydNzi5kIW1JTBAqoOTnKBXI3JYgOmjqaFtYG5RYmXjYWohNHodAZ1OozLZIpoDGZAkMQPtEhMUrN5ktUFlVqg9qhtrsNiMUUd0acsed8Zdroo7npcpIZE9inlSg5Qf12nooVYDCYhCYgW14WC-gZTJYtFpQojkWMkpMyZismAAE6qqSq1IAGwIADNNQBbIkJeWo44Ys4XK5FW6ie55R62l4ISGgoTi-l6Uzcj0WAxCiH+HQmCIORo1ap6Cyy4lmo5qjWqkgAJXYrBTtAdjMKz1ZHkaOn85SEQnCkLM2nBQoG7zh1n8hj56gsZjLMViIFQUggcGUcsOxAeTOd+YQ7k0wbq9jq9QCTV5QonRbqmm0JhqfPFBn8sdNg5SaVQGSxw9zLNApXcPx009bdXB-gXViF7V0vVMVjbdUbob3BwVNETmVM9mSUMcwl8D1-iMWFtHhIUTHeTRSy8Wwy3hcwzH-ElJlgQgpimOB4EdEc80vYF6kqIQ-g3SczFCSEhTqW8TH5DctECBwghw+NJm7dB6E2PBtWQCBQNHCiyksHReWsOoWyMadXzMXR-CEOo7CsbQtIMXiDx0RNNQk8jVEQRoDCgixIwhLwoQGGttLBSwLFsAY4RBbCOyAA */
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
  on: {
    APPLY_INTENT_HASH: {
      actions: assign({
        intentHash: ({ event }) => event.params.intentHash,
      }),
    },
  },
  states: {
    pending: {
      always: {
        target: "checking",
        guard: "isReadyToCheck",
      },
    },
    checking: {
      invoke: {
        src: "checkIntentStatus",
        input: ({ context }) => {
          assert(context.intentHash != null, "intentHash is null")
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
