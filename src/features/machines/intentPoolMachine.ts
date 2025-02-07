import type { providers } from "near-api-js"
import {
  type ActorRef,
  type ActorRefFrom,
  type Snapshot,
  assign,
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
}

type Input = {
  parentRef: ParentActor
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
        const snapshot = context.parentRef.getSnapshot()
        const balances =
          // @ts-ignore - The parent ref's context type is not properly inferred by TypeScript
          snapshot.context.depositedBalanceRef.getSnapshot().context.balances
        return findExecutableIntentRef(
          context.intentRefs,
          context.pool,
          balances
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
    spawnIntentStatusAndReplaceActor: assign({
      intentRefs: (
        { context, spawn },
        output: { tag: "ok"; value: { intentHash: string } }
      ) => {
        if (output?.tag === "ok" && output?.value?.intentHash) {
          assert(
            context.checkingIntentRef !== null,
            "checkingIntentRef is null"
          )
          return context.intentRefs.map((intentRef) => {
            if (intentRef.id === context.checkingIntentRef) {
              return spawn("intentStatusActor", {
                id: intentRef.id,
                input: {
                  ...intentRef.getSnapshot().context,
                  intentHash: output.value.intentHash,
                },
              })
            }
            return intentRef
          })
        }
        return context.intentRefs
      },
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
  /** @xstate-layout N4IgpgJg5mDOIC5QEsB2AXMGC0AHA9vgDYDEAggCIUD6AkgHIAqAokwNoAMAuoqAbMnTJ8qXiAAeibAEYAbABYAdAE4O0gKwAOAEzS9AZnnz1AdgA0IAJ5T5mlZs3SOp-bM3r1ykwF9vFtJg4BMQk9MwA6tQAigCqAPIsnDxIIPyCwqIpkggGirLKmibark756tqaFtYI2LpKmsrlhaby2vLSPn4gAVjoeIREigCOAK5gY2hQJEliaUIiYtnqHYr6Jhya+lvyJtI6+lWIerKK0vqO6hxb5wWavv4Yvf3Ew2MTqFNs0sl8+ALzmVAS2kShM6nk+g2HFarX06kOCG04JUtnyHW0G3a0nu3UeQQGr3GYEmJHEsHQAENMIoKQAzTAAJwAFJcOABKEg9fEvUZEyYzFJzDKLI5yRRggrSZS3cFS+FWI6KYzaRrOZT6JHSbQmToPQJ9YKDXAjABGRGQsAAFiSICIwIo0AA3fAAa3tXPQACEGfgKRAAMYU8kAJTAtIFv3+wqyR3Kik0siRbkTmnajlkCP06qVW2U8mU2gxhYqutx+ueRtN5qtNrtDtQzrd9f13t9AaD6FD4e+sz+6QWMZqhfUimWDg0JmUxyc8uq7SUe0TIJ0862OI9FcUxrNFutHxIYAZPoZW6IVNp+AZAFtm71W37AyGwxHUn2ASKanITCoNY4ZSZ8w1BFimkRRiy1ZYCizaVSw3Q1FEdQ9kFpSwSRfIUByBRBNjsbU9DUHRlFkADKgVREITAvMOGcSEMTUToulQfAIDgMQ4IGXso0wiQpG1fRRz2C5J2nZwERkVwlXHM4zhVXQ9HXPEDQJZAICIMBOP7QEeIQVRtFObRZEuWwkTzaQES1fiANheQ1GI4iEwU8t4N5d4oA099BxkBwwN0BoFDk2RXG0BFVFWcd80M1MdQAxynng7dqz3NzBTfaMsJyDhvxsvMilM2Q9mUYCVVOAo0WhcE6PUWLuUGRCGWQ1CPnctLtJMVMwP0KVVEC2wszMsi01WQL8sLIj1EC9R9F8XwgA */
  id: "intent-pool",

  initial: "idle",

  context: ({ input }) => ({
    parentRef: input.parentRef,
    intentRefs: [],
    pool: new Map(),
    intentCreationResult: null,
    checkingIntentRef: null,
    executingIntentRef: null,
  }),

  on: {
    ADD_INTENT: {
      target: ".queueing",
      actions: ["clearIntentCreationResult", "spawnIntentStatusActor"],
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
