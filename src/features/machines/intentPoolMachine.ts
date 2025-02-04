import type { providers } from "near-api-js"
import type { QuoteResult } from "src/services/quoteService"
import type { BaseTokenInfo, UnifiedTokenInfo } from "src/types/base"
import type { Nep413DefuseMessageFor_DefuseIntents } from "src/types/defuse-contracts-types"
import type {
  SwappableToken,
  WalletMessage,
  WalletSignatureResult,
} from "src/types/swap"
import { assert } from "src/utils/assert"
import { computeTotalBalanceDifferentDecimals } from "src/utils/tokenUtils"
import type { ChainType } from "../../types/deposit"
import type { DefuseUserId } from "../../utils/defuse"
import type { QuoteInput } from "./backgroundQuoterMachine"

import {
  type ActorRef,
  type ActorRefFrom,
  type Snapshot,
  assign,
  setup,
} from "xstate"
import type { ParentEvents as BackgroundQuoterEvents } from "./backgroundQuoterMachine"
import type { BalanceMapping } from "./depositedBalanceMachine"
import {
  type Output as IntentPublisherOutput,
  intentPublisherMachine,
} from "./intentPublisherMachine"
import type {
  IntentDescription,
  IntentOperationParams,
  Output as IntentSignerOutput,
} from "./intentSignerMachine"
import { intentStatusMachine } from "./intentStatusMachine"
import type { SendNearTransaction } from "./publicKeyVerifierMachine"

type Input = {
  parentRef: ParentActor
}

export type IntentCreationResult =
  | IntentSignerOutput
  | IntentPublisherOutput
  | null

export type IntentRef = {
  intentHash: string | null
  txHash: string | null
  tokenIn: SwappableToken
  tokenOut: SwappableToken
  intentDescription: IntentDescription
  intentOperationParams: IntentOperationParams
  signature: WalletSignatureResult
  messageToSign: null | {
    walletMessage: WalletMessage
    innerMessage: Nep413DefuseMessageFor_DefuseIntents
  }
  userAddress: string
  userChainType: ChainType
  nearClient: providers.Provider
  sendNearTransaction: SendNearTransaction
  defuseUserId: DefuseUserId
  referral?: string
  slippageBasisPoints: number
}

type ParentReceivedEvents = {
  type: "NEW_QUOTE"
  params: {
    quoteInput: QuoteInput
    quote: QuoteResult
  }
}

type ParentActor = ActorRef<Snapshot<unknown>, ParentReceivedEvents>

export type Events =
  | {
      type: "ADD_INTENT"
      params: IntentRef
    }
  | BackgroundQuoterEvents

type PassthroughEvent = {
  type: "INTENT_SETTLED"
  data: {
    intentHash: string
    txHash: string
    tokenIn: BaseTokenInfo | UnifiedTokenInfo
    tokenOut: BaseTokenInfo | UnifiedTokenInfo
  }
}

export const intentPoolMachine = setup({
  types: {
    context: {} as {
      parentRef: ParentActor
      intentCreationResult: IntentCreationResult
      intentRefs: ActorRefFrom<typeof intentStatusMachine>[]
      executingIntentRef: string | null
      checkingIntentRef: string | null
    },
    events: {} as Events | PassthroughEvent,
    input: {} as Input,
  },
  actors: {
    intentStatusActor: intentStatusMachine,
    intentPublisherActor: intentPublisherMachine,
  },
  actions: {
    spawnIntentStatusActor: assign({
      intentRefs: ({ context, event, spawn, self }) => {
        assert(event.type === "ADD_INTENT", "event is not ADD_INTENT")
        const id = crypto.randomUUID()
        const intentRef = spawn("intentStatusActor", {
          id: `intent-${id}`,
          input: {
            parentRef: self,
            ...event.params,
          },
        })
        return [intentRef, ...context.intentRefs]
      },
    }),
    setExecutingIntentRef: assign({
      executingIntentRef: ({ context }) => {
        const snapshot = context.parentRef.getSnapshot()
        const balances = (
          snapshot as unknown as {
            context: {
              depositedBalanceRef: {
                getSnapshot: () => {
                  context: { balances: BalanceMapping }
                }
              }
            }
          }
        ).context.depositedBalanceRef.getSnapshot().context.balances

        for (const intentRef of context.intentRefs) {
          const { value } = intentRef.getSnapshot()
          // Meaning we already start executing this intent so we should run it again
          if (!value.match("pending")) {
            continue
          }
          const intent = intentRef.getSnapshot().context

          if (intent.intentHash === null) {
            const onchainBalance = computeTotalBalanceDifferentDecimals(
              intent.tokenIn,
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
        }
        return null
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
  },
  guards: {
    hasUnexecutedIntents: ({ context }) =>
      context.intentRefs.some((intentRef) => {
        const { value } = intentRef.getSnapshot()
        const isPending = value.match("pending")
        return isPending
      }),
    hasExecutingIntent: ({ context }) => context.executingIntentRef !== null,
    hasCheckingIntent: ({ context }) => context.checkingIntentRef !== null,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEsB2AXMGC0AHA9vgDYDEAggCIUD6AkgHIAqAokwNoAMAuoqAbMnTJ8qXiAAeibAFYAjADYAdPIXSAnBwAcHACwBmAExrNAGhABPKbI5rFAdnl29endZ3udTgL5ezaTDgExCT0zADq1ACKAKoA8iycPEgg-ILCosmSCNguOsquRpoGmnY6xRx2ZpbZhrKKeipOstLSegpqsj5+GFjoeIREigCOAK5gY2hQJIliqUIiYlnY8hwGigocKmrOBnI6VYhGeorS8np20tqydgZ6210g-r39xMNjE6hTbLJJfPgC8wyoCW1zsihsZWK22kHA4532FkO2xOZwuVxudz0DyegQGb3GYEmJHEsHQAENMIoyQAzTAAJwAFDCOABKEg4vpBQajAmTGbJObpRZSAwXRQGWTXWQdaV2ay6A7ZHQcdaGEqyNp2LTyeRqeTYnq4164EYAIyIyFgAAsiRARGBFGgAG74ADWDo5AAUzRbrWA6QAlMDU-l-AFCzJSGF1TQlHQlM5lIrnRUNMHOVzM2QGSFqA0BTl4k3my02z4kf10-B0xS4IgU6nVgC2jsN6G9Jb9geDoZS-zSC0jCAUxxUOjOZ1hajKOtT2kUmmsNyKep0lx0+eeXMUTv9yGp5iJvcFg+BUm2SgMRg01gMOs8COqd9smnOEtj8jvWukPl8IFQ+AQHAYgci8RCzP2gLCtkxh5Feag3qs96lIq2CyuKjiGKKHDShCBibkagzIBARBgBB4anhIUhxguOFrg+kL6Iq0hrJoniGM4r52K+1j6n+oHbjyHxQORA5AlR2QsUocryNomjRtYsiPki9TsRqcrSKUOx8d0BZgbWPqlpMolQUO2A5kokquGoLQGDYRiyam3H2CUegcNI44Ia4WL8W2+m7nS+6Hp8JkRmeMEasoRRyHcHTnOoTmaC5ThpvobQ2b+XhAA */
  id: "intent-pool",

  initial: "idle",

  context: ({ input }) => ({
    parentRef: input.parentRef,
    intentRefs: [],
    intentCreationResult: null,
    checkingIntentRef: null,
    executingIntentRef: null,
  }),

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
        id: "intentPublisherRef",
        src: "intentPublisherActor",
        input: ({ context }) => {
          assert(
            context.executingIntentRef !== null,
            "executingIntentRef is null"
          )
          const intent = extractIntent({
            intentRefs: context.intentRefs,
            id: context.executingIntentRef,
          })
          assert(intent !== undefined, "intent is undefined")
          assert(intent.signature != null, "signature is null")
          assert(intent.messageToSign != null, "messageToSign is null")

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
      entry: [
        {
          type: "spawnIntentStatusAndReplaceActor",
          // @ts-expect-error
          params: ({ event }) => event.output,
        },
      ],
      target: "queueing",

      always: {
        target: "idle",
        actions: ["clearCheckingIntentRef"],
        reenter: true,
      },
    },
  },

  on: {
    ADD_INTENT: {
      target: ".queueing",
      actions: "spawnIntentStatusActor",
    },
    NEW_QUOTE: {},
  },
})

function extractIntent({
  intentRefs,
  id,
}: { intentRefs: ActorRefFrom<typeof intentStatusMachine>[]; id: string }) {
  const intentRef = intentRefs.find((ref) => ref.id === id)
  const intent = intentRef?.getSnapshot().context
  assert(intent !== undefined, "intent is undefined")
  return intent
}
