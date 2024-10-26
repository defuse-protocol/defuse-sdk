import { parseUnits } from "ethers"
import type { providers } from "near-api-js"
import {
  type ActorRefFrom,
  assertEvent,
  assign,
  emit,
  fromPromise,
  sendTo,
  setup,
  spawnChild,
} from "xstate"
import type { SwappableToken } from "../../types"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../types/base"
import type { Transaction } from "../../types/deposit"
import {
  type ChildEvent as BackgroundQuoterEvents,
  backgroundQuoterMachine,
} from "./backgroundQuoterMachine"
import {
  type BalanceMapping,
  type Events as DepositedBalanceEvents,
  depositedBalanceMachine,
} from "./depositedBalanceMachine"
import { intentStatusMachine } from "./intentStatusMachine"
import type { AggregatedQuote } from "./queryQuoteMachine"
import {
  type Output as SwapIntentMachineOutput,
  swapIntentMachine,
} from "./swapIntentMachine"

export type Context = {
  error: Error | null
  quote: AggregatedQuote | null
  formValues: {
    tokenIn: SwappableToken
    tokenOut: SwappableToken
    amountIn: string
  }
  parsedFormValues: {
    amountIn: bigint
  }
  intentCreationResult: SwapIntentMachineOutput | null
  intentRefs: ActorRefFrom<typeof intentStatusMachine>[]
}

type PassthroughEvent = {
  type: "INTENT_SETTLED"
  data: {
    intentHash: string
    txHash: string
    tokenIn: BaseTokenInfo | UnifiedTokenInfo
    tokenOut: BaseTokenInfo | UnifiedTokenInfo
    quote: AggregatedQuote
  }
}

export const swapUIMachine = setup({
  types: {
    input: {} as {
      tokenIn: SwappableToken
      tokenOut: SwappableToken
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
            nearClient: providers.Provider
            sendNearTransaction: (
              tx: Transaction
            ) => Promise<{ txHash: string } | null>
          }
        }
      | {
          type: "BALANCE_CHANGED"
          params: {
            changedBalanceMapping: BalanceMapping
          }
        }
      | BackgroundQuoterEvents
      | DepositedBalanceEvents
      | PassthroughEvent,

    emitted: {} as PassthroughEvent,

    children: {} as {
      depositedBalanceRef: "depositedBalanceActor"
    },
  },
  actors: {
    backgroundQuoterActor: backgroundQuoterMachine,
    depositedBalanceActor: depositedBalanceMachine,
    formValidationActor: fromPromise(async (): Promise<boolean> => {
      throw new Error("not implemented")
    }),
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
            amountIn: 0n,
          }
        }
      },
    }),
    updateUIAmountOut: () => {
      throw new Error("not implemented")
    },
    setQuote: assign({
      quote: (_, value: AggregatedQuote) => value,
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
      input: ({ self }) => ({ parentRef: self, delayMs: 5000 }),
    }),
    // Warning: This cannot be properly typed, so you can send an incorrect event
    sendToBackgroundQuoterRefNewQuoteInput: sendTo(
      "backgroundQuoterRef",
      ({ context, self }) => {
        const snapshot = self.getSnapshot()

        // However knows how to access the child's state, please update this
        const depositedBalanceRef:
          | ActorRefFrom<typeof depositedBalanceMachine>
          | undefined = snapshot.children.depositedBalanceRef
        const balances = depositedBalanceRef?.getSnapshot().context.balances

        return {
          type: "NEW_QUOTE_INPUT",
          params: {
            tokenIn: context.formValues.tokenIn,
            tokenOut: context.formValues.tokenOut,
            amountIn: context.parsedFormValues.amountIn,
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
      input: ({ self }) => ({ parentRef: self }),
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
      (_, event: BackgroundQuoterEvents) => event
    ),

    spawnIntentStatusActor: assign({
      intentRefs: (
        { context, spawn, self },
        output: SwapIntentMachineOutput
      ) => {
        if (output.status !== "INTENT_PUBLISHED") return context.intentRefs

        // todo: take quote from result of `swap`
        assert(context.quote != null, "quote is null")

        const intentRef = spawn("intentStatusActor", {
          id: `intent-${output.intentHash}`,
          input: {
            parentRef: self,
            intentHash: output.intentHash,
            tokenIn: context.formValues.tokenIn,
            tokenOut: context.formValues.tokenOut,
            quote: context.quote,
          },
        })

        return [intentRef, ...context.intentRefs]
      },
    }),
  },
  guards: {
    isQuoteRelevant: ({ context }) => {
      // todo: implement real check for fetched quotes if they're expired or not
      console.warn(
        "Implement real check for fetched quotes if they're expired or not"
      )
      return context.quote != null && context.quote.totalAmountOut > 0n
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaArgSwGIBJAOQBUBRcgfQGUKyyAZCgEQG0AGAXUVAwD2sPABc8AgHZ8QAD0QBGACwBmAHSLFAJnmdNnABybtigOwAaEAE9EWfSYCsqzff2d5J+c5P7lJgL5+FqiYuIQAQgCCTBEkAMIU1ACqAAqsEZQcPNKCwmKS0nIIWJquqgBs+ooGWgCcNR4mmmUW1kV2js6u7p723sr6AUHo2PiqkKJ4ElAEsDgARgC2oly8SCA5E-lrhfLuqiY1OprKivL69r32LTbKdeWaNWV1JZyPT4MgwSN4YxATUwRJhgcCIVtkhJspNsbE0Ort7Jx7PIyq8Sr5rkVfDVVEplG5lGVlPJbo8Pl9Qr9-tMSBQAOrUACKiQA8pQwWsNnkoaBClhTGo6sp7Lc7DVOFVlBisGVFI4emUZfZtPo7PIycMKeMxFNVAA3NAAGzwEDQ2umEEkYFUk11AgA1lbyaMtZMoHrDcbTa6EDaBABjL2SFbs-gQrkFGwuNQPeyKfQ6fQVLTNKw2ByqIUmV7yGpVC41HzqkLOv5m91Gk1mggWiRW30O1ROn4unX6iteqY+iS2gNc4PyVah3LibmySPnVScPEIpQq8Up1pYJSaSdnZTaJSKFFnMpF76N+ZLERVmt17v2x3DABKYAAZiH1mGRxGEKd5E4C5uNIn4+4pXiVy3SofxOAlTn8QJPg1UZZkWUQqzAAAnRCBEQ1QMANU1b1QhZG2vO8H05Z9oVfW4nHhIkyhcJ4VCuVMimRRR9lqWVlyaEwtD3ClYKPKsaXpJlWQoQiny2HlEFoydDl2F5wMRKVYxMDMygeAkfBolSAkgiQBAgOBpCbcFhzEscigqd8p0RNw41cLcpRMA4nG8fFtwVGpNC4ksqSMyEX2lZQ1EsmcbPnBTiQ-YUVI8XZ4wgoZi2bUtXWtCADTAHzwxIvlenUddzmOHNNAOcx6OKMVyJFZxThORQamUTzEqpctPTNDLiPEopjmxXwjERbwKjqFV7KU0U6qKwx+mJerIKbA84OPV02pMwp+kcU4URKDcygcErF1ORxdGcTxjjxYkty0vwgA */
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
      amountIn: 0n,
    },
    intentCreationResult: null,
    intentRefs: [],
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
      actions: [
        ({ event }) => {
          console.log("Balance changed", event.params.changedBalanceMapping)
        },
        "sendToBackgroundQuoterRefNewQuoteInput",
      ],
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
          invoke: {
            src: "formValidationActor",

            onDone: [
              {
                target: "idle",
                guard: ({ event }) => event.output,
                actions: "sendToBackgroundQuoterRefNewQuoteInput",
              },
              "idle",
            ],
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
          if (!quote) {
            throw new Error("quote not available")
          }

          return {
            userAddress: event.params.userAddress,
            nearClient: event.params.nearClient,
            sendNearTransaction: event.params.sendNearTransaction,
            quote,
            tokenIn: context.formValues.tokenIn,
            tokenOut: context.formValues.tokenOut,
            amountIn: context.parsedFormValues.amountIn,
          }
        },

        onDone: {
          target: "editing",

          actions: [
            {
              type: "spawnIntentStatusActor",
              params: ({ event }) => event.output,
            },
            {
              type: "setIntentCreationResult",
              params: ({ event }) => event.output,
            },
          ],
        },

        onError: {
          target: "editing",

          actions: ({ event }) => {
            console.error(event.error)
          },
        },
      },

      on: {
        NEW_QUOTE: {
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

function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}
