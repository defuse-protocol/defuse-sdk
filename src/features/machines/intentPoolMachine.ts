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
import { getPendingDeltaBalances, isOptimisticIntent } from "../../utils/pool"
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

export type Intent = {
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

      assert(
        context.depositedBalanceRef !== null,
        "depositedBalanceRef is null"
      )

      const intentRefs = [intentRef, ...context.intentRefs]
      const pool = new Map([[`intent-${id}`, event.params], ...context.pool])

      const quoteToPublish = event.params.quoteToPublish
      // We might not have a quoteToPublish if the intent type is withdraw
      const tokenDeltaIn = quoteToPublish?.tokenDeltas
        ? quoteToPublish.tokenDeltas[0]
        : undefined

      const isOptimistic =
        tokenDeltaIn !== undefined &&
        isOptimisticIntent(
          tokenDeltaIn,
          context.depositedBalanceRef.getSnapshot().context.onchainBalances
        )
      if (isOptimistic) {
        const pendingDeltaBalance = getPendingDeltaBalances(intentRefs, pool)
        context.depositedBalanceRef.send({
          type: "REQUEST_BALANCE_REFRESH",
          params: {
            pendingDeltaBalance,
          },
        })
      }

      return {
        intentRefs,
        pool,
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
          context.depositedBalanceRef.getSnapshot().context.onchainBalances
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

        const newPool = new Map(context.pool)
        newPool.set(context.executingIntentRef, {
          ...intent,
          intentHash: output.value.intentHash,
        })
        return newPool
      },
    }),
    passthroughEventAndRefreshBalances: emit(
      ({ context }, event: PassthroughEvent) => {
        assert(
          context.depositedBalanceRef !== null,
          "depositedBalanceRef is null"
        )
        const pendingDeltaBalance = getPendingDeltaBalances(
          context.intentRefs,
          context.pool
        )
        context.depositedBalanceRef.send({
          type: "REQUEST_BALANCE_REFRESH",
          params: {
            pendingDeltaBalance,
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
    hasCheckingIntent: ({ context }) => context.checkingIntentRef !== null,
    hasExecutingIntent: ({ context }) => context.executingIntentRef !== null,
    isOk: (_, a: { tag: "err" | "ok" }) => a.tag === "ok",
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEsB2AXMGC0AHA9vgDYDEAggCIUD6AkgHIAqAokwNoAMAuoqAbMnTJ8qXiAAeibAEYATAFYAdADYAHPIDMqgJwB2edu3zpGjQBoQATynLlK1buUdVs6Zoe7dAXy8W0mHAJiEgYWJmoAZWZGRgAZZgpOHiQQfkFhURTJBA1dWUVtW2VtDlNlABZtSvMrKVllfOltDXLlOWkOQ0Nynz8MLHQ8QlJ6ZgB1agBFAFUAeRYksTShETFsuV1FUr1nXIrPZXkLawRsWQ1tRVc1A2dy3XLy2R7fEH8BoeJFAEcAVzB-mgoCRFillhk1lJpE0CvJqlppG1KmpjohnnYquUOOd7hwTHlem9+oFhj9-oDUMC2NJknx8AIVplQOt6op1MVZLoHC5Sq1UQh0QVHhwOA9ynJmrlCe8SV8-gCwECQbJaal6elVllELklLoNAotOcXLJVCZ+YLMdiWro8blZNLiYMgkQyQqlWwNKrwZrmYgnpt1BoGk5ZEZdE1+S18p1ZJ0HrITeUWg6Ak7SbhfgAjIjIWAACyVEBEYEUaAAbvgANYlmXoABCACd8ABDCAAY2bsHQACUwAAzUF0hkQrWnRF2TqIoPhkp67H8+TOLYmQzSVQNJqqdQpj7OxQZ7O5guUkhF1A11AV6ulx2Nlvtzs9-vUr3qxmQ07uRT63QlC6tLEI1qBB5FcRRKg4TRnCKKp5B3WUXQPHN8yVMAGybBt9yIZt0D7fAGwAWxvVM71bDsu17AduCWN8R19U5ylUDhFAeJp5FNOFXAuGoTg0eQ7ERNcqg0NxSiReC0y+Ms0OQPtLHdaiwVon0JEQTRowTPF+KY7QE20fk8nKLYg1FNoqmNDQJM+F080ISsSHELscJLZs+0wBsAApFxFABKEha2sxRbKrQc1WHFTsnqZiLhFUxYxcddyn5aElG4x5lD40DOlaHxXlQfAIDgMQAudGjwqZVTP3Xb9OT-KoKjxfTgJkOFFDXRwTAuZouWUKy92QCAiDAMqNQq7JWiUbE3EOWw5FAni-Rab9hQ4Bp3Eg-i+tJeUKSgEb31HGRyiUAx5HWkSE2kY7+RKb9mkeHQOnDNQXj6VNAqQo8gX2ujKrOaFFDhe55H0aQ9W0aEFpyVqTFUVoUuhLk3C2qSZLk76lPKj8ZAeNrRNB9iNFFfUDITZd6iEhxinXFGbLsn6Ir9NoWNUfU6qu7R110ZKTDZe7jGhNR9WMXKvCAA */
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
          guard: "hasExecutingIntent",
          target: "publishing",
          reenter: true,
        },
        {
          guard: "hasCheckingIntent",
          target: "verifying",
          reenter: true,
        },
        {
          target: "hook",
          reenter: true,
          guard: "hasUnexecutedIntents",
        },
        {
          target: "idle",
          reenter: true,
        },
      ],
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
        target: "hook",
        actions: ["clearCheckingIntentRef"],
        reenter: true,
      },
    },

    hook: {
      after: {
        "5000": {
          target: "queueing",
          reenter: true,
        },
      },
    },
  },
})
