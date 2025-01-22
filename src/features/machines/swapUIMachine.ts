import type { providers } from "near-api-js"
import {
  type ActorRefFrom,
  assertEvent,
  assign,
  emit,
  sendTo,
  setup,
  spawnChild,
} from "xstate"
import { settings } from "../../config/settings"
import { logger } from "../../logger"
import type { QuoteResult } from "../../services/quoteService"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../types/base"
import type { ChainType, Transaction } from "../../types/deposit"
import type { SwappableToken } from "../../types/swap"
import { assert } from "../../utils/assert"
import { userAddressToDefuseUserId } from "../../utils/defuse"
import { parseUnits } from "../../utils/parse"
import { getAnyBaseTokenInfo } from "../../utils/tokenUtils"
import {
  type Events as BackgroundQuoterEvents,
  type ParentEvents as BackgroundQuoterParentEvents,
  backgroundQuoterMachine,
} from "./backgroundQuoterMachine"
import {
  type BalanceMapping,
  type Events as DepositedBalanceEvents,
  depositedBalanceMachine,
} from "./depositedBalanceMachine"
import { intentStatusMachine } from "./intentStatusMachine"
import {
  type Output as SwapIntentMachineOutput,
  swapIntentMachine,
} from "./swapIntentMachine"

export type Context = {
  error: Error | null
  quote: QuoteResult | null
  formValues: {
    tokenIn: SwappableToken
    tokenOut: SwappableToken
    amountIn: string
  }
  parsedFormValues: {
    amountIn: bigint | null
  }
  intentCreationResult: SwapIntentMachineOutput | null
  intentRefs: ActorRefFrom<typeof intentStatusMachine>[]
  tokenList: SwappableToken[]
  referral?: string
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

type EmittedEvents = PassthroughEvent | { type: "INTENT_PUBLISHED" }

export const swapUIMachine = setup({
  types: {
    input: {} as {
      tokenIn: SwappableToken
      tokenOut: SwappableToken
      tokenList: SwappableToken[]
      referral?: string
    },
    context: {} as Context,
    events: {} as
      | {
          type: "input"
          params: Partial<{
            tokenIn: SwappableToken
            tokenOut: SwappableToken
            amountIn: string
          }>
        }
      | {
          type: "submit"
          params: {
            userAddress: string
            userChainType: ChainType
            nearClient: providers.Provider
            sendNearTransaction: (
              tx: Transaction["NEAR"]
            ) => Promise<{ txHash: string } | null>
          }
        }
      | {
          type: "BALANCE_CHANGED"
          params: {
            changedBalanceMapping: BalanceMapping
          }
        }
      | BackgroundQuoterParentEvents
      | DepositedBalanceEvents
      | PassthroughEvent,

    emitted: {} as EmittedEvents,

    children: {} as {
      depositedBalanceRef: "depositedBalanceActor"
      swapRef: "swapActor"
    },
  },
  actors: {
    backgroundQuoterActor: backgroundQuoterMachine,
    depositedBalanceActor: depositedBalanceMachine,
    swapActor: swapIntentMachine,
    intentStatusActor: intentStatusMachine,
  },
  actions: {
    setFormValues: assign({
      formValues: (
        { context },
        {
          data,
        }: {
          data: Partial<{
            tokenIn: SwappableToken
            tokenOut: SwappableToken
            amountIn: string
          }>
        }
      ) => ({
        ...context.formValues,
        ...data,
      }),
    }),
    parseFormValues: assign({
      parsedFormValues: ({ context }) => {
        try {
          return {
            amountIn: parseUnits(
              context.formValues.amountIn,
              context.formValues.tokenIn.decimals
            ),
          }
        } catch {
          return {
            amountIn: null,
          }
        }
      },
    }),
    updateUIAmountOut: () => {
      throw new Error("not implemented")
    },
    setQuote: assign({
      quote: (_, value: QuoteResult) => value,
    }),
    clearQuote: assign({ quote: null }),
    clearError: assign({ error: null }),
    setIntentCreationResult: assign({
      intentCreationResult: (_, value: SwapIntentMachineOutput) => value,
    }),
    clearIntentCreationResult: assign({ intentCreationResult: null }),
    passthroughEvent: emit((_, event: PassthroughEvent) => event),
    spawnBackgroundQuoterRef: spawnChild("backgroundQuoterActor", {
      id: "backgroundQuoterRef",
      input: ({ self }) => ({
        parentRef: self,
        delayMs: settings.quotePollingIntervalMs,
      }),
    }),
    // Warning: This cannot be properly typed, so you can send an incorrect event
    sendToBackgroundQuoterRefNewQuoteInput: sendTo(
      "backgroundQuoterRef",
      ({ context, self }): BackgroundQuoterEvents => {
        const snapshot = self.getSnapshot()

        // However knows how to access the child's state, please update this
        const depositedBalanceRef:
          | ActorRefFrom<typeof depositedBalanceMachine>
          | undefined = snapshot.children.depositedBalanceRef
        const balances = depositedBalanceRef?.getSnapshot().context.balances

        assert(context.parsedFormValues.amountIn != null, "amountIn is not set")

        return {
          type: "NEW_QUOTE_INPUT",
          params: {
            tokenIn: context.formValues.tokenIn,
            tokenOut: getAnyBaseTokenInfo(context.formValues.tokenOut),
            amountIn: {
              amount: context.parsedFormValues.amountIn,
              decimals: context.formValues.tokenIn.decimals,
            },
            balances: balances ?? {},
          },
        }
      }
    ),
    // Warning: This cannot be properly typed, so you can send an incorrect event
    sendToBackgroundQuoterRefPause: sendTo("backgroundQuoterRef", {
      type: "PAUSE",
    }),

    spawnDepositedBalanceRef: spawnChild("depositedBalanceActor", {
      id: "depositedBalanceRef",
      input: ({ self, context }) => ({
        parentRef: self,
        tokenList: context.tokenList,
      }),
    }),
    relayToDepositedBalanceRef: sendTo(
      "depositedBalanceRef",
      (_, event: DepositedBalanceEvents) => event
    ),
    sendToDepositedBalanceRefRefresh: sendTo("depositedBalanceRef", (_) => ({
      type: "REQUEST_BALANCE_REFRESH",
    })),

    // Warning: This cannot be properly typed, so you can send an incorrect event
    sendToSwapRefNewQuote: sendTo(
      "swapRef",
      (_, event: BackgroundQuoterParentEvents) => event
    ),

    spawnIntentStatusActor: assign({
      intentRefs: (
        { context, spawn, self },
        output: SwapIntentMachineOutput
      ) => {
        if (output.tag !== "ok") return context.intentRefs

        if (output.value.intentProcess === "standard") {
          const intentRef = spawn("intentStatusActor", {
            id: `intent-${output.value.intentHash}`,
            input: {
              parentRef: self,
              intentHash: output.value.intentHash,
              tokenIn: context.formValues.tokenIn,
              tokenOut: context.formValues.tokenOut,
              intentDescription: output.value.intentDescription,
            },
          })

          return [intentRef, ...context.intentRefs]
        }

        return context.intentRefs
      },
    }),

    emitEventIntentPublished: emit(() => ({
      type: "INTENT_PUBLISHED" as const,
    })),
  },
  guards: {
    isQuoteRelevant: ({ context }) => {
      // todo: implement real check for fetched quotes if they're expired or not
      logger.warn(
        "Implement real check for fetched quotes if they're expired or not"
      )
      return context.quote != null && context.quote.tag === "ok"
    },

    isOk: (_, a: { tag: "err" | "ok" }) => a.tag === "ok",

    isFormValid: ({ context }) => {
      return (
        context.parsedFormValues.amountIn != null &&
        context.parsedFormValues.amountIn > 0n
      )
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaArgSwGIBJAOQBUBRcgfQGUKyyAZCgEQG0AGAXUVAwD2sPABc8AgHZ8QAD0RYArAHYlAOgAcAJgAs2gIzq9ndQDYAnHr0AaEAE95Rzms6dNZ9QGZtphds5mAXwCbVExcQgAhAEEmKJIAYQpqeIAJOIBxNi5eJBBBYTFJaTkEDxM9VTLNVwUPJR0zE00bewQsMzMPVQVNE30zXwUjdyCQ9Gx8AiYAeXTSbOl80XEpXJK+yr0PTmVLPTNNXoUW+Q6unr79weH1UZBQicIZ9OmAVTIF3KXC1dASrE0ek0lRMJg8vRUnC2Hi2JzaHTMqi2SnMfkO6nUPTuD3CqkgywkUAIsBwACMALaiT78ITLIprRBAtSNJScLwmJReXwGOFYPycVSaJQYlEcsoDJTY8a4-FiQkEPASDA4ETUvK0n7FeQwtQ6Dz6oaHTgmUweXkedQC5QG+oo7RKCxSsL4PEQAlEkgUADq1AAiq9ppQ1d8Vlq2va1HoHfsLSL9iZeSb1Kp-AYLV4OnoFE7Hq73aoAG5oAA2eAgaDlRODGtDDLaHgUAv8uxUe2UJmOdkQJit5k6nXMWe2JhzMrdlcLJbLFcVVb0ORpBVrf3k2jM2lUPeMUPqMM0Dd5QJTmkxSnt-g5LO0o5dstnqnQ7uoAEccAIRGACJ6ff7AxRq0u9IrvCTjdAclpRvu6icuo5pDKo+j7HoPZ1DCWLBPc0ouiSFKiJWBAQJIYCqIqBYCAA1sRDwAEpgAAZgBdK-LIiCNiYqhKAoFhrh466Yh0natFgyEKJuph6H4nRbCa14YTi2FkpSIj4YREjEaRFFUeMtEMfOiw1kBLEIN4iIDOo2iaD0PScQeXYIEebgmvqvHbCK+o3ngqg4Up+FgAATn5Ah+aoGDFhWdFBeSXnafRjGanWyHJqytQNn4fhMtYdkAhYHFODCAxrpw2gKNmclYZ53l4bOX7en6AZBjw+mAcxJR+F0eUDBJjSWj0vLKBulhmDZa6WnaQQYRIAgQHA0jyXgTVMWGwkuOc4E7lBMG8uZyZcQYmKeMhxp6B5eaVgt8XAe0JVgSe60WptWXcimnINjo9RNCdd6EiREDFmA53LkZfLKAh4KYvu+xCkNvJuAKgK8Vo3JeDxn3jveRaluWZ1fAZLXyPuiJ1EayimOoHQYryKgaA6nRCloFrQqj+aPpWL5vh+AOGf8KIChiOzKMYviAgmj0btoHbVB2YIWUhI5lc6FWKVVhKc3jxnaF0fGNoCbjeOYvL8horgNhyPSHFm40BEAA */
  id: "swap-ui",

  context: ({ input }) => ({
    error: null,
    quote: null,
    formValues: {
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut,
      amountIn: "",
    },
    parsedFormValues: {
      amountIn: null,
    },
    intentCreationResult: null,
    intentRefs: [],
    tokenList: input.tokenList,
    referral: input.referral,
  }),

  entry: ["spawnBackgroundQuoterRef", "spawnDepositedBalanceRef"],

  on: {
    INTENT_SETTLED: {
      actions: [
        {
          type: "passthroughEvent",
          params: ({ event }) => event,
        },
        "sendToDepositedBalanceRefRefresh",
      ],
    },

    BALANCE_CHANGED: {
      guard: "isFormValid",
      actions: "sendToBackgroundQuoterRefNewQuoteInput",
    },

    LOGIN: {
      actions: {
        type: "relayToDepositedBalanceRef",
        params: ({ event }) => event,
      },
    },
    LOGOUT: {
      actions: {
        type: "relayToDepositedBalanceRef",
        params: ({ event }) => event,
      },
    },
  },

  states: {
    editing: {
      on: {
        submit: {
          target: "submitting",
          guard: "isQuoteRelevant",
          actions: "clearIntentCreationResult",
        },

        input: {
          target: ".validating",
          actions: [
            "clearQuote",
            "updateUIAmountOut",
            "sendToBackgroundQuoterRefPause",
            "clearError",
            {
              type: "setFormValues",
              params: ({ event }) => ({ data: event.params }),
            },
            "parseFormValues",
          ],
        },

        NEW_QUOTE: {
          actions: [
            {
              type: "setQuote",
              params: ({ event }) => event.params.quote,
            },
            "updateUIAmountOut",
          ],
        },
      },

      states: {
        idle: {},

        validating: {
          always: [
            {
              target: "waiting_quote",
              guard: "isFormValid",
              actions: "sendToBackgroundQuoterRefNewQuoteInput",
            },
            "idle",
          ],
        },

        waiting_quote: {
          on: {
            NEW_QUOTE: {
              target: "idle",
              actions: [
                {
                  type: "setQuote",
                  params: ({ event }) => event.params.quote,
                },
                "updateUIAmountOut",
              ],
              description: `should do the same as NEW_QUOTE on "editing" itself`,
            },
          },
        },
      },

      initial: "idle",
      entry: "updateUIAmountOut",
    },

    submitting: {
      invoke: {
        id: "swapRef",
        src: "swapActor",

        input: ({ context, event }) => {
          assertEvent(event, "submit")

          const quote = context.quote
          assert(quote !== null, "non valid quote")
          assert(quote.tag === "ok", "non valid quote")
          return {
            userAddress: event.params.userAddress,
            userChainType: event.params.userChainType,
            defuseUserId: userAddressToDefuseUserId(
              event.params.userAddress,
              event.params.userChainType
            ),
            referral: context.referral,
            nearClient: event.params.nearClient,
            sendNearTransaction: event.params.sendNearTransaction,
            intentOperationParams: {
              type: "swap" as const,
              quote: quote.value,
            },
          }
        },

        onDone: [
          {
            target: "editing",
            guard: { type: "isOk", params: ({ event }) => event.output },

            actions: [
              {
                type: "spawnIntentStatusActor",
                params: ({ event }) => event.output,
              },
              {
                type: "setIntentCreationResult",
                params: ({ event }) => event.output,
              },
              "emitEventIntentPublished",
            ],
          },
          {
            target: "editing",

            actions: [
              {
                type: "setIntentCreationResult",
                params: ({ event }) => event.output,
              },
            ],
          },
        ],

        onError: {
          target: "editing",

          actions: ({ event }) => {
            logger.error(event.error)
          },
        },
      },

      on: {
        NEW_QUOTE: {
          guard: {
            type: "isOk",
            params: ({ event }) => event.params.quote,
          },
          actions: [
            {
              type: "setQuote",
              params: ({ event }) => event.params.quote,
            },
            {
              type: "sendToSwapRefNewQuote",
              params: ({ event }) => event,
            },
          ],
        },
      },
    },
  },

  initial: "editing",
})
