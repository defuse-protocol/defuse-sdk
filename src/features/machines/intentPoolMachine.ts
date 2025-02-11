import type { providers } from "near-api-js"
import {
  type ActorRef,
  type ActorRefFrom,
  type Snapshot,
  assign,
  emit,
  setup,
} from "xstate"
import { findExecutableIntentRef } from "../../services/poolService"
import type { QuoteResult } from "../../services/quoteService"
import type { AggregatedQuote } from "../../services/quoteService"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../types/base"
import type { Nep413DefuseMessageFor_DefuseIntents } from "../../types/defuse-contracts-types"
import type { ChainType } from "../../types/deposit"
import type { WalletMessage, WalletSignatureResult } from "../../types/swap"
import { assert } from "../../utils/assert"
import type { DefuseUserId } from "../../utils/defuse"
import type { PriorityQueue } from "../../utils/priorityQueue"
import type { QuoteInput } from "./backgroundQuoterMachine"
import type { ParentEvents as BackgroundQuoterEvents } from "./backgroundQuoterMachine"
import type { depositedBalanceMachine } from "./depositedBalanceMachine"
import {
  type Output as IntentBroadcastMachineOutput,
  intentBroadcastMachine,
} from "./intentBroadcastMachine"
import type {
  IntentDescription,
  IntentOperationParams,
  Output as IntentSignMachineOutput,
} from "./intentSignMachine"
import { intentStatusMachine } from "./intentStatusMachine"
import type { SendNearTransaction } from "./publicKeyVerifierMachine"

type Context = {
  parentRef: ParentActor
  intentCreationResult:
    | IntentSignMachineOutput
    | IntentBroadcastMachineOutput
    | null
  intentRefs: ActorRefFrom<typeof intentStatusMachine>[]
  pool: Map<string, Intent>
  executingIntentRef: string | null
  checkingIntentRef: string | null
  depositedBalanceRef: ActorRefFrom<typeof depositedBalanceMachine> | null
}

type Input = {
  parentRef: ParentActor
  depositedBalanceRef: ActorRefFrom<typeof depositedBalanceMachine> | null
}

type ParentReceivedEvents = {
  type: "NEW_QUOTE"
  params: {
    quoteInput: QuoteInput
    quote: QuoteResult
  }
}

type ParentContext = {
  depositedBalanceRef: ActorRefFrom<typeof depositedBalanceMachine>
}

type ParentActor = ActorRef<Snapshot<ParentContext>, ParentReceivedEvents>

type PassthroughEvent = {
  type: "INTENT_SETTLED"
  data: {
    intentHash: string
    txHash: string
    tokenIn: BaseTokenInfo | UnifiedTokenInfo
    tokenOut: BaseTokenInfo | UnifiedTokenInfo
  }
}

type Intent = {
  userAddress: string
  userChainType: ChainType
  defuseUserId: DefuseUserId
  referral?: string
  slippageBasisPoints: number
  nearClient: providers.Provider
  sendNearTransaction: SendNearTransaction
  intentOperationParams: IntentOperationParams
  quoteToPublish: AggregatedQuote | null
  quotes: PriorityQueue<AggregatedQuote>
  messageToSign: {
    walletMessage: WalletMessage
    innerMessage: Nep413DefuseMessageFor_DefuseIntents
  }
  signature: WalletSignatureResult
  intentDescription: IntentDescription
  tokenIn: BaseTokenInfo | UnifiedTokenInfo
  tokenOut: BaseTokenInfo | UnifiedTokenInfo
  intentHash: string | null
}

export type Events = {
  type: "ADD_INTENT"
  params: Intent
}

export const intentPoolMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Events | BackgroundQuoterEvents | PassthroughEvent,
    input: {} as Input,
  },
  actors: {
    intentStatusActor: intentStatusMachine,
    intentBroadcastActor: intentBroadcastMachine,
  },
  actions: {
    spawnIntentStatusActor: assign(({ context, event, spawn, self }) => {
      assert(event?.type === "ADD_INTENT", "event is not ADD_INTENT")
      const id = crypto.randomUUID()

      const intentRef = spawn("intentStatusActor", {
        id: `intent-${id}`,
        input: {
          parentRef: self,
          intentHash: null,
          tokenIn: event.params.tokenIn,
          tokenOut: event.params.tokenOut,
          intentDescription: event.params.intentDescription,
        },
      })

      return {
        intentRefs: [intentRef, ...context.intentRefs],
        pool: new Map([[`intent-${id}`, event.params]]),
      }
    }),
    setExecutingIntentRef: assign({
      executingIntentRef: ({ context }) => {
        assert(
          context.depositedBalanceRef !== null,
          "depositedBalanceRef is null"
        )
        return findExecutableIntentRef(
          context.intentRefs,
          context.pool,
          context.depositedBalanceRef.getSnapshot().context.balances
        )
      },
    }),
    clearExecutingIntentRef: assign({
      executingIntentRef: null,
    }),
    setCheckingIntentRef: assign({
      checkingIntentRef: ({ context }) => {
        const executingIntentRef = context.executingIntentRef
        assert(executingIntentRef !== null, "executingIntentRef is null")
        return executingIntentRef
      },
    }),
    clearCheckingIntentRef: assign({
      checkingIntentRef: null,
    }),
    sendIntentStatusRefIntentHash: assign({
      intentRefs: ({ context }) => {
        return context.intentRefs.map((intentRef) => {
          assert(
            context.checkingIntentRef !== null,
            "checkingIntentRef is null"
          )
          const intent = context.pool.get(context.checkingIntentRef)
          assert(intent !== undefined, "intent is undefined")
          const intentHash = intent.intentHash
          assert(intentHash !== null, "intentHash is null")
          if (intentRef.id === context.checkingIntentRef) {
            intentRef.send({
              type: "APPLY_INTENT_HASH",
              params: {
                intentHash,
              },
            })
          }
          return intentRef
        })
      },
    }),
    setIntentCreationResult: assign({
      intentCreationResult: (
        _,
        value: IntentBroadcastMachineOutput | IntentSignMachineOutput
      ) => value,
    }),
    clearIntentCreationResult: assign({ intentCreationResult: null }),
    setIntentHash: assign({
      pool: ({ context }, output: IntentBroadcastMachineOutput) => {
        assert(output?.tag === "ok", "output is not ok")
        assert(
          context.executingIntentRef !== null,
          "executingIntentRef is null"
        )
        const intent = context.pool.get(context.executingIntentRef)
        assert(intent !== undefined, "intent is undefined")
        return new Map([
          [
            context.executingIntentRef,
            {
              ...intent,
              intentHash: output.value.intentHash,
            },
          ],
        ])
      },
    }),
    passthroughEventAndRefreshBalances: emit(
      ({ context }, event: PassthroughEvent) => {
        context.depositedBalanceRef?.send({
          type: "REQUEST_BALANCE_REFRESH",
          params: {
            pendingDeltaBalance: {},
          },
        })
        return event
      }
    ),
  },
  guards: {
    hasUnexecutedIntents: ({ context }) =>
      context.intentRefs.some((intentRef) => {
        const { value } = intentRef.getSnapshot()
        return value === "pending"
      }),
    hasExecutingIntent: ({ context }) => context.executingIntentRef !== null,
    hasCheckingIntent: ({ context }) => context.checkingIntentRef !== null,
    isOk: (_, a: { tag: "err" | "ok" }) => a.tag === "ok",
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEsB2AXMGC0AHA9vgDYDEAggCIUD6AkgHIAqAokwNoAMAuoqAbMnTJ8qXiAAeibAEYAbABYAdAE4O0gKwAOAEzS9AZnnz1AdgA0IAJ5T5mlZs3SOp-bM3r1ykwF9vFtJg4BMQkDCxM1ADKzIyMADLMFJw8SCD8gsKiqZII+g6K8iYmyqpyhcqyyhbWCNja8rKK0sra6hwmeZry2tpuvv4YWOh4hKT0zADq1ACKAKoA8izJYulCImI5BoomHEYmmrJuJrJymtVSPfqKup7yhsX6Tsb9IAFDI8SKAI4ArmB-aCgJGWqVWmQ2iHU0hMin0O00+kRhWkOn05wQeka0jyGg4iLyygcLzeQVG3z+ANQQLY0hSfHwAjWWVAOShShM6juHE0u3q2n06nRrSUylslWh2m58j0xMGpM+v3+YEBJHEsHQAENMIoNQAzTAAJwAFG0OABKEgk4bBIjkpWAkH0xng7KITHbTyOEoOTnNQVWN0FdTaZRtTz6VrSbRFWWBa1k3A-ABGRGQsAAFiqICIwIo0AA3fAAa1zVoAQgb8BqIABjDXqgBKYF1jrSDIy61dGODigOrTcsm0XRRcnR+mUVzu4-kLUlPSHPj8rzl8c+iZTaczVJI2dQpdQhZLeZXFartfr6CbLdpK3bTIhtR66kUUIcGmKmKc-pq0qUKMH0i2PUgGIrG7w2oo66phmKpgAalYGpBRBarq+AGgAtsecantWdaNs2rZgp2LJSHIMITkOzQ+iYM4RkKjzXD0UZQoS44lIuAxxh8tr5nByC6pYKqEXeLokQgCJ2NGehqDoFQ0WcAYIPUVwhvIHDOPoHCSmoi5Lqg+AQHAYhWtxt7OsREgXB0L4oo4pjKJ+zjojIrgFG+2IKI4hiGGB8q2sgEBEGAZkdsylkIKo2hNL0bRAbc0jolGVw0d0hhqLIxz7LIvmrraiqUlAIX3l2Mj5ExmgVN0mKuNo6KqLCb4zrIWiFEU8g5dxkHJtBW6FaCIkWZs7QFBwoomKpcgolUik9MoTSEuKuyctp6gdRBvEGvxglUkVonhfsSj8s0qiyIYCIOei0p2K4rhRiGzWneo+i+L4QA */
  id: "intent-pool",

  initial: "idle",

  context: ({ input }) => ({
    parentRef: input.parentRef,
    intentRefs: [],
    pool: new Map(),
    intentCreationResult: null,
    checkingIntentRef: null,
    executingIntentRef: null,
    depositedBalanceRef: input.depositedBalanceRef,
  }),

  on: {
    ADD_INTENT: {
      target: ".queueing",
      actions: ["clearIntentCreationResult", "spawnIntentStatusActor"],
    },
    INTENT_SETTLED: {
      actions: [
        {
          type: "passthroughEventAndRefreshBalances",
          params: ({ event }) => event,
        },
      ],
    },
    NEW_QUOTE: {},
  },

  states: {
    idle: {},

    queueing: {
      entry: "setExecutingIntentRef",

      always: [
        {
          guard: "hasCheckingIntent",
          target: "verifying",
          reenter: true,
        },
        {
          guard: "hasExecutingIntent",
          target: "publishing",
        },
      ],

      after: {
        "500": {
          target: "queueing",
          guard: "hasUnexecutedIntents",
        },
      },
    },

    publishing: {
      invoke: {
        id: "intentBroadcastRef",
        src: "intentBroadcastActor",
        input: ({ context }) => {
          assert(
            context.executingIntentRef !== null,
            "executingIntentRef is null"
          )
          const intent = context.pool.get(context.executingIntentRef)
          assert(intent !== undefined, "intent is undefined")

          return intent
        },
        onDone: [
          {
            target: "verifying",
            guard: { type: "isOk", params: ({ event }) => event.output },

            actions: [
              {
                type: "setIntentHash",
                params: ({
                  event,
                }: { event: { output: IntentBroadcastMachineOutput } }) =>
                  event.output,
              },
              "setCheckingIntentRef",
              "clearExecutingIntentRef",
            ],
          },
          {
            target: "queueing",
            actions: [
              {
                type: "setIntentCreationResult",
                params: ({ event }) => event.output,
              },
              "clearExecutingIntentRef",
            ],
          },
        ],
        onError: {
          target: "queueing",
          actions: "clearExecutingIntentRef",
        },
      },
    },

    verifying: {
      entry: "sendIntentStatusRefIntentHash",
      target: "queueing",

      always: {
        target: "idle",
        actions: ["clearCheckingIntentRef"],
        reenter: true,
      },
    },
  },
})
