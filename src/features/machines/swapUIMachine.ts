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
import type {
  BaseTokenInfo,
  TokenValue,
  UnifiedTokenInfo,
} from "../../types/base"
import type { ChainType, Transaction } from "../../types/deposit"
import type { SwappableToken } from "../../types/swap"
import { assert } from "../../utils/assert"
import { userAddressToDefuseUserId } from "../../utils/defuse"
import { parseUnits } from "../../utils/parse"
import {
  getAnyBaseTokenInfo,
  getTokenMaxDecimals,
  getUnderlyingBaseTokenInfos,
} from "../../utils/tokenUtils"
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
import {
  type Output as IntentBroadcastMachineOutput,
  intentBroadcastMachine,
} from "./intentBroadcastMachine"
import {
  type Output as IntentSignMachineOutput,
  intentSignMachine,
} from "./intentSignMachine"
import { intentStatusMachine } from "./intentStatusMachine"

export type Context = {
  error: Error | null
  quote: QuoteResult | null
  formValues: {
    tokenIn: SwappableToken
    tokenOut: SwappableToken
    amountIn: string
  }
  parsedFormValues: {
    tokenOut: BaseTokenInfo
    amountIn: TokenValue | null
  }
  intentCreationResult:
    | IntentSignMachineOutput
    | IntentBroadcastMachineOutput
    | null
  intentRefs: ActorRefFrom<typeof intentStatusMachine>[]
  tokenList: SwappableToken[]
  referral?: string
  slippageBasisPoints: number
  intentSignResult: IntentSignMachineOutput | null
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

type Events =
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
  | PassthroughEvent

export const swapUIMachine = setup({
  types: {
    input: {} as {
      tokenIn: SwappableToken
      tokenOut: SwappableToken
      tokenList: SwappableToken[]
      referral?: string
    },
    context: {} as Context,
    events: {} as Events,

    emitted: {} as EmittedEvents,

    children: {} as {
      depositedBalanceRef: "depositedBalanceActor"
      intentSignRef: "intentSignActor"
      intentBroadcastRef: "intentBroadcastActor"
    },
  },
  actors: {
    backgroundQuoterActor: backgroundQuoterMachine,
    depositedBalanceActor: depositedBalanceMachine,
    intentStatusActor: intentStatusMachine,
    intentSignActor: intentSignMachine,
    // biome-ignore lint/suspicious/noExplicitAny: Remove `any` once you figure out how to properly type the machine to resolve TypeScript error TS7056 (can't assign machine to actor)
    intentBroadcastActor: intentBroadcastMachine as any,
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
        const tokenOut = getAnyBaseTokenInfo(context.formValues.tokenOut)

        try {
          const decimals = getTokenMaxDecimals(context.formValues.tokenIn)
          return {
            tokenOut,
            amountIn: {
              amount: parseUnits(context.formValues.amountIn, decimals),
              decimals,
            },
          }
        } catch {
          return {
            tokenOut,
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
      intentCreationResult: (
        _,
        value: IntentBroadcastMachineOutput | IntentSignMachineOutput
      ) => value,
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
            tokenOut: context.parsedFormValues.tokenOut,
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
    sendToIntentSignRefNewQuote: sendTo(
      "intentSignRef",
      (_, event: BackgroundQuoterParentEvents) => event
    ),

    spawnIntentStatusActor: assign({
      intentRefs: (
        { context, spawn, self },
        output: IntentBroadcastMachineOutput
      ) => {
        if (output.tag !== "ok") return context.intentRefs

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
      },
    }),

    emitEventIntentPublished: emit(() => ({
      type: "INTENT_PUBLISHED" as const,
    })),
    setIntentSignResult: assign({
      intentSignResult: (_, value: IntentSignMachineOutput) => value,
    }),
    clearIntentSignResult: assign({ intentSignResult: null }),
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
        context.parsedFormValues.amountIn.amount > 0n
      )
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaArgSwGIBJAOQBUBRcgfQGUKyyAZCgEQG0AGAXUVAwD2sPABc8AgHZ8QAD0RYAzAHZOAOk5KlATgAsADmUA2AKwbjxgDQgAnvK16ATKoUOdO4wq0PDARmV6AXwCrVExcQgAhAEEmKJIAYQpqeIAJOIBxNi5eJBBBYTFJaTkEYy9VBzKHL2N3Hx1fK1sELC1DPVU9HW1OboMehyCQ9Gx8AiYAeXTSbOl80XEpXJLqnVUdBz0tTQUdLVqHByUmu3bO7t1HBr1zBSGQUNHCSfSJgFUyWdz5wqXQEqwDh8qjKnCOui0nGMSmUSj0JxabQ6XW0+lc7Vu90e4VUkAWEigBFgOAARgBbURffhCBZFZaIBRdVRaHz1UyGSGOTg+BFYHQ+Do6BQc1xCrquQbBB4jHF4sQEgh4CQYHAiKl5Gm-YryaqqJSVfaOYUafUOXmMtTQhS7fXuPScXx3KXY-C4iD4wkkCgAdWoAEU3hNKOqfottS0HA71Dcyva9m1jI5eSZDNHNLVhcZKtosTLXXKlVBVAA3NAAGzwEDQ8sJIc1YfpLWhzkM3iUrYdDR0Dt5uvM-W5SiFLk4BlzYXz7prJfLlerhYI7B8OWpBQb-x1vmZcN6hgaClZnChCKcSmhHkMjPM3Q046ebo9qnQHuoAEccAIRGACF7fQGgxQdZrnSG5NrqR5KD4MKGL0PiXieR4gpwWjCiyUKXmexh3jixLkqINYEBAkhgKoSrFgIADWJFKl+EgiLQeBQBIABKYAAGZAbSfyyIgQ5rCme6Xi4wrwTY8hwWoGy9Ho7RwY4nLYa6uEUiIBFERI1ESORVGkXRYB0QxTGsRxy5zPWIE8QgygKBUGyVJshiOfGvL1KmuieBoHJopsTrDBOeCqMp+ELmAABOoUCKFqgYGW1ZsZFZK6bR9GMSx7GcVqjZ7pJuiRtmjhQQovb6s4lQaD4RxbHCcGKQFQWqQuv7+oGwY8GZwHcSUQ5aJ0Z4KMYPhtChHhFWJTaaKol5CsYjmtuyOi1aoJIRWgEAAMZoLABFhRFUUxXFCVJfpIgRCt62bSIxkZeulmeE4eh6CoAouDUiaWGNqYOIymFggYg3VCYQRShIAgQHA0gung7VceGWBzeo5XQbBonNFgehwSCj1ng9yhtJKfn3gWBLQ5loFYNCSgI5BSP8ij8gDcY6gwv1v1tj4WHOnmAVE0WlZlmAJM3QCjKntCUHQmCWYbO9zSWhoewco5MJtCYgSc-5D7TqWFZVjWgsWSU+iqGyfh+ErHJ+DL4kY6brJ7O42xwgt6uE1OhZPmgL7vp+AvfOZnUMk4X0+J2j20+jPJjd4TgNGVhyQbcjmLfVet+x14btGs-LVDulTQt4vL8h0bScMKBhAoY2iVIty0CKtG1bYW+sBwgsnOMKwmVDJL0ImsQIjR40L7ECpdAwEQA */
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
      tokenOut: getAnyBaseTokenInfo(input.tokenOut),
      amountIn: null,
    },
    intentCreationResult: null,
    intentRefs: [],
    tokenList: input.tokenList,
    referral: input.referral,
    slippageBasisPoints: 100, // 1%
    intentSignResult: null,
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
        id: "intentSignRef",
        src: "intentSignActor",

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
            slippageBasisPoints: context.slippageBasisPoints,
            nearClient: event.params.nearClient,
            sendNearTransaction: event.params.sendNearTransaction,
            intentOperationParams: {
              type: "swap" as const,
              tokensIn: getUnderlyingBaseTokenInfos(context.formValues.tokenIn),
              tokenOut: context.parsedFormValues.tokenOut,
              quote: quote.value,
            },
          }
        },

        onDone: [
          {
            target: "broadcasting",
            guard: { type: "isOk", params: ({ event }) => event.output },

            actions: [
              {
                type: "setIntentSignResult",
                params: ({ event }) => event.output,
              },
              {
                type: "setIntentCreationResult",
                params: ({ event }) => event.output,
              },
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
              type: "sendToIntentSignRefNewQuote",
              params: ({ event }) => event,
            },
          ],
        },
      },
    },

    broadcasting: {
      invoke: {
        id: "intentBroadcastRef",
        src: "intentBroadcastActor",

        input: ({ context }: { context: Context }) => {
          assert(context.intentSignResult !== null, "intentSignResult is null")
          assert(
            context.intentSignResult.tag === "ok",
            "intentSignResult is not ok"
          )
          return {
            ...context.intentSignResult.value,
          }
        },

        onDone: [
          {
            target: "editing",
            guard: {
              type: "isOk",
              params: ({
                event,
              }: { event: { output: IntentBroadcastMachineOutput } }) =>
                event.output,
            },
            actions: [
              {
                type: "spawnIntentStatusActor",
                params: ({
                  event,
                }: { event: { output: IntentBroadcastMachineOutput } }) =>
                  event.output,
              },
              {
                type: "setIntentCreationResult",
                params: ({
                  event,
                }: { event: { output: IntentBroadcastMachineOutput } }) =>
                  event.output,
              },
              "emitEventIntentPublished",
            ],
          },
          {
            target: "editing",
            actions: [
              {
                type: "setIntentCreationResult",
                params: ({
                  event,
                }: { event: { output: IntentBroadcastMachineOutput } }) =>
                  event.output,
              },
            ],
          },
          // biome-ignore lint/suspicious/noExplicitAny: Remove `any` once you figure out how to properly type the machine to resolve TypeScript error TS7056 (can't assign machine to actor)
        ] as any,

        onError: {
          target: "editing",

          actions: ({ event }) => {
            logger.error(event.error)
          },
        },

        exit: {
          actions: "clearIntentSignResult",
        },

        on: {
          NEW_QUOTE: {
            guard: {
              type: "isOk",
              params: ({
                event,
              }: { event: { params: { quote: QuoteResult } } }) =>
                event.params.quote,
            },
            actions: [
              {
                type: "setQuote",
                params: ({
                  event,
                }: { event: { params: { quote: QuoteResult } } }) =>
                  event.params.quote,
              },
              {
                type: "sendToIntentSignRefNewQuote",
                params: ({
                  event,
                }: { event: { params: { quote: QuoteResult } } }) => event,
              },
            ],
          },
        },
      },
    },
  },

  initial: "editing",
})
