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
import { type ActorRef, type Snapshot, assign, setup } from "xstate"
import type { ChainType } from "../../types/deposit"
import type { DefuseUserId } from "../../utils/defuse"
import type { QuoteInput } from "./backgroundQuoterMachine"
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
  tokenIn: SwappableToken
  tokenOut: SwappableToken
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
  intentHash: string | null
  intentDescription: IntentDescription | null
}

type ParentReceivedEvents = {
  type: "NEW_QUOTE"
  params: {
    quoteInput: QuoteInput
    quote: QuoteResult
  }
}

type ParentActor = ActorRef<Snapshot<unknown>, ParentReceivedEvents>

export type Events = {
  type: "ADD_INTENT"
  params: IntentRef
}

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
      intentRefs: IntentRef[]
      executingIntentRef: number | null
      checkingIntentRef: number | null
    },
    events: {} as Events | PassthroughEvent,
    input: {} as Input,
  },
  actors: {
    intentStatusActor: intentStatusMachine,
    intentPublisherActor: intentPublisherMachine,
  },
  actions: {
    addIntent: assign(({ context, event }) => {
      assert(event.type === "ADD_INTENT", "event is not ADD_INTENT")
      return {
        intentRefs: [
          ...context.intentRefs,
          {
            ...event.params,
            intentHash: null,
          },
        ],
      }
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
        for (const ref of context.intentRefs) {
          if (ref.intentHash === null) {
            const onchainBalance = computeTotalBalanceDifferentDecimals(
              ref.tokenIn,
              balances
            )
            if (onchainBalance === undefined) {
              continue
            }
            const tokenDeltas = ref.intentOperationParams.quote?.tokenDeltas
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
            return context.intentRefs.indexOf(ref)
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
    setIntentHashAndDescription: assign(
      (
        { context },
        intent: {
          intentHash: string
          intentDescription: IntentDescription
        }
      ) => ({
        intentRefs: context.intentRefs.map((ref, index) => {
          assert(
            context.executingIntentRef !== null,
            "executingIntentRef is null"
          )
          return index === context.executingIntentRef
            ? {
                ...ref,
                intentHash: intent.intentHash,
                intentDescription: intent.intentDescription,
              }
            : ref
        }),
      })
    ),
    clearIntentCreationResult: assign({ intentCreationResult: null }),
  },
  guards: {
    hasUnexecutedIntents: ({ context }) =>
      context.intentRefs.some((ref) => ref.intentHash === null),
    hasExecutingIntent: ({ context }) => context.executingIntentRef !== null,
    hasQueueingIntent: ({ context }) => context.checkingIntentRef !== null,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEsB2AXMGC0AHA9vgDYDEAggCIUD6AkgHIAqAokwNoAMAuoqAbMnTJ8qXiAAeibABYAjLIB0ADgDMHAKyyAnACYdW+QDZDAGhABPKbKUL16pfPk7pKwxwDs7gL5ezaTDgExArIEERgJJw8SCD8gsKiMZII2DqyKrY6HKo6hmru2rKmFohF0socsu4q6u55ue5a0j5+GFjoeIRECgCOAK5gA2hQkdxicUIiYsky0hwKKlpqKo3qWloF6maWCPoZ6nnu9pXuOosrLSD+7Z3B-YNgw5Gy0Xz4ApOJoDNV7gocTT0SiW6g4HBW0m2iD2tkOxyqZyWl2ugS6vQGQ1QI3EsHQAENMAo8QAzTAAJwAFKCOABKEgojpBbr3TFQKLjd7xKZJKRKQzlQx6bR2ZzOLRKKEIMr-TSnVSGMrqHTeXxXNqo4K4PoAIyIyFgAAsnhARGAQqgAG74ADWZoZAAUdXrDWAyQAlMDE9kxCYJaZWfkKHT2fTB7JqSqS+zlJT2WMcQyaMHrZHqxloi2u5DE8zG03mq2280BdAAZXx6D6sA9XrGPs5n39KXU0hsgtjG2063FUbk-1kAMW2W0KljPlVqHwEDgYgZtyIHI+fp5KQMOgUgrSWhF0jFEpKKQHhhlDmy9hbrek6lTJfnITCYEXXK+EisoIWGnWicqujOOijNhnMYajGGsAL8s0qpzky6IPMMT6Niu2BKuUOjAg4oqjnM7iSrIdj9qoF5aIYSjBsRN43DBWq6vqRpYghy7fFIzjHnyngjioaTSIYuiStIu4KLIuTyE0iYDrk15QWmd6ZmS2a5vR9ZLtyTHNgCG7Kuc4rqConGQgepzlPYCqcYsypKGO45AA */
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
    idle: {
      always: [
        {
          guard: "hasUnexecutedIntents",
          target: "queueing",
        },
      ],
    },

    queueing: {
      entry: "setExecutingIntentRef",

      after: {
        500: {
          target: "queueing",
          guard: "hasUnexecutedIntents",
        },
      },

      always: [
        {
          guard: "hasQueueingIntent",
          target: "verifying",
        },
        {
          guard: "hasExecutingIntent",
          target: "publishing",
        },
      ],
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
          const intentRef = context.intentRefs[context.executingIntentRef]
          assert(intentRef !== undefined, "intentRef is undefined")
          assert(intentRef.signature != null, "signature is null")
          assert(intentRef.messageToSign != null, "messageToSign is null")
          return {
            userAddress: intentRef.userAddress,
            userChainType: intentRef.userChainType,
            nearClient: intentRef.nearClient,
            sendNearTransaction: intentRef.sendNearTransaction,
            intentOperationParams: intentRef.intentOperationParams,
            defuseUserId: intentRef.defuseUserId,
            referral: intentRef.referral,
            signature: intentRef.signature,
            messageToSign: intentRef.messageToSign,
            slippageBasisPoints: intentRef.slippageBasisPoints,
          }
        },
        onDone: {
          target: "verifying",
          actions: [
            {
              type: "setIntentHashAndDescription",
              params: ({ event }) => {
                assert(event.output.tag === "ok")
                return event.output.value
              },
            },
            "setCheckingIntentRef",
            "clearExecutingIntentRef",
          ],
          reenter: true,
        },
        onError: {
          target: "queueing",
          actions: "clearExecutingIntentRef",
        },
      },
    },

    verifying: {
      invoke: {
        id: "intentStatusRef",
        src: "intentStatusActor",
        input: ({ context, self }) => {
          assert(
            context.checkingIntentRef !== null,
            "checkingIntentRef is null"
          )
          const intentRef = context.intentRefs[context.checkingIntentRef]
          assert(intentRef !== undefined, "intentRef is undefined")
          assert(intentRef.intentHash !== null, "intentHash is null")
          assert(
            intentRef.intentDescription !== null,
            "intentDescription is null"
          )
          return {
            parentRef: self,
            intentHash: intentRef.intentHash,
            tokenIn: intentRef.tokenIn,
            tokenOut: intentRef.tokenOut,
            intentDescription: intentRef.intentDescription,
          }
        },
        onDone: {
          target: "queueing",
          actions: ["clearCheckingIntentRef"],
        },
      },
    },
  },

  on: {
    ADD_INTENT: {
      target: ".queueing",
      actions: "addIntent",
    },
  },
})
