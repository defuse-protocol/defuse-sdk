import type { providers } from "near-api-js"
import type { QuoteResult } from "src/services/quoteService"
import type { BaseTokenInfo, UnifiedTokenInfo } from "src/types/base"
import type { Nep413DefuseMessageFor_DefuseIntents } from "src/types/defuse-contracts-types"
import type { WalletMessage, WalletSignatureResult } from "src/types/swap"
import { assert } from "src/utils/assert"
import { computeTotalBalanceDifferentDecimals } from "src/utils/tokenUtils"
import type { AggregatedQuote } from "../../services/quoteService"
import type { ChainType } from "../../types/deposit"
import type { DefuseUserId } from "../../utils/defuse"
import type { PriorityQueue } from "../../utils/priorityQueue"
import type { QuoteInput } from "./backgroundQuoterMachine"

import {
  type ActorRef,
  type ActorRefFrom,
  type Snapshot,
  assign,
  setup,
} from "xstate"
import type { ParentEvents as BackgroundQuoterEvents } from "./backgroundQuoterMachine"
import type {
  BalanceMapping,
  depositedBalanceMachine,
} from "./depositedBalanceMachine"
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
    clearIntentCreationResult: assign({
      intentCreationResult: null,
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
          if (intentRef.id === context.checkingIntentRef) {
            intentRef.send({
              type: "APPLY_INTENT_HASH",
              params: {
                intentHash: context.checkingIntentRef,
              },
            })
          }
          return intentRef
        })
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
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEsB2AXMGC0AHA9vgDYDEAggCIUD6AkgHIAqAokwNoAMAuoqAbMnTJ8qXiAAeibAEYAbABYAdAE4O0gKwAOAEzS9AZnnz1AdgA0IAJ5T5mlZs3SOp-bM3r1ykwF9vFtJg4BMQk9MwA6tQAigCqAPIsnDxIIPyCwqIpkggGirLKmibark756tqaFtYI2LpKmsrlhaby2vLSPn4gAVjoeIREigCOAK5gY2hQJEliaUIiYtnqHYr6Jhya+lvyJtI6+lWIerKK0vqO6hxb5wWavv4Yvf3Ew2MTqFNs0sl8+ALzmVAS2kShM6nk+g2HFarX06kOCG04JUtnyHW0G3a0nu3UeQQGr3GYEmJHEsHQAENMIoKQAzTAAJwAFJcOABKEg9fEvUZEyYzFJzDKLI5yRRggrSZS3cFS+FWI6KYzaRrOZT6JHSbQmToPQJ9YKDXAjABGRGQsAAFiSICIwIo0AA3fAAa3tXPQACEGfgKRAAMYU8kAJTAtIFv3+wqyR2U2hUJi8Kp2ENaygRhn04vkHDU2oc2v0ZxxHueRtN5qtJLADJ9DMUuCIVNp+AZAFsHXivT6-YGQ2GI6k-ukFjGanITCoNY4ZSZ5OrtAjitJFNo11rlgV9NKvCWu2XFI6a8haZYSYOhaOgYhNFdTrZtRDk7I2kuVmcOpC2so9JtfF1UHwCA4DEUtDVmYcARFGpihOdcGgUXQ5FcRcFXHVwlQcJwtE0ecdXVPd9QPZAICIMAIKjK8JBvWRJ1zNYVQqDcdARWxFE2dwGPOZMtlkQinkNQl3igCiR0BajxwcVddAQ1pjhQhFVFWLD51kLQdh1eR+O5cszQta0PlEqCxycScc2UHZkzkPZ0zQtdlFOAo0WhcEMWcbSDQJI8GRPM9DMFSDo2vBA5wcpwf0KMEPDkWQMw8Ryi0hc49g4WQ+P-IA */
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
      actions: "spawnIntentStatusActor",
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

          return {
            userAddress: intent.userAddress,
            userChainType: intent.userChainType,
            nearClient: intent.nearClient,
            sendNearTransaction: intent.sendNearTransaction,
            intentOperationParams: intent.intentOperationParams,
            defuseUserId: intent.defuseUserId,
            referral: intent.referral,
            signature: intent.signature,
            messageToSign: intent.messageToSign,
            slippageBasisPoints: intent.slippageBasisPoints,
            quoteToPublish: intent.quoteToPublish,
            quotes: intent.quotes,
            intentDescription: intent.intentDescription,
          }
        },
        onDone: {
          target: "verifying",
          actions: ["setCheckingIntentRef", "clearExecutingIntentRef"],
        },
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

function findExecutableIntentRef(
  intentRefs: ActorRefFrom<typeof intentStatusMachine>[],
  pool: Map<string, Intent>,
  balances: BalanceMapping
): string | null {
  for (const intentRef of intentRefs) {
    const { value } = intentRef.getSnapshot()
    // Meaning we already start executing this intent so we should run it again
    if (value !== "pending") {
      continue
    }
    const intent = pool.get(intentRef.id)
    assert(intent !== undefined, "intent is undefined")

    const onchainBalance = computeTotalBalanceDifferentDecimals(
      intentRef.getSnapshot().context.tokenIn,
      balances
    )
    if (onchainBalance === undefined) {
      continue
    }
    const tokenDeltas = intent.intentOperationParams.quote?.tokenDeltas
    if (tokenDeltas === undefined || tokenDeltas.length === 0) {
      continue
    }
    const [_, amount] = tokenDeltas[0] as [string, bigint]
    if (amount === undefined) {
      continue
    }
    // Multiply amount by -1n because the amount is negative
    if (onchainBalance.amount < amount * -1n) {
      continue
    }
    return intentRef.id
  }
  return null
}
