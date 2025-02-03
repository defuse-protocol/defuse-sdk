import type { providers } from "near-api-js"
import { userAddressToDefuseUserId } from "src/utils/defuse"
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
  type Events as IntentPoolEvents,
  intentPoolMachine,
} from "./intentPoolMachine"
import { intentSignerMachine } from "./intentSignerMachine"

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
  tokenList: SwappableToken[]
  referral?: string
  slippageBasisPoints: number
  depositedBalanceRef: ActorRefFrom<typeof depositedBalanceMachine>
  intentPoolRef: ActorRefFrom<typeof intentPoolMachine>
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
      | PassthroughEvent
      | IntentPoolEvents,

    emitted: {} as EmittedEvents,
  },
  actors: {
    backgroundQuoterActor: backgroundQuoterMachine,
    depositedBalanceActor: depositedBalanceMachine,
    intentSignerActor: intentSignerMachine,
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    intentPoolActor: intentPoolMachine as any,
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
      ({ context }): BackgroundQuoterEvents => {
        assert(context.parsedFormValues.amountIn != null, "amountIn is not set")
        return {
          type: "NEW_QUOTE_INPUT",
          params: {
            tokenIn: context.formValues.tokenIn,
            tokenOut: context.parsedFormValues.tokenOut,
            amountIn: context.parsedFormValues.amountIn,
            balances:
              context.depositedBalanceRef.getSnapshot().context.balances,
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
        context.parsedFormValues.amountIn.amount > 0n
      )
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaArgSwGIBJAOQBUBRcgfQGUKyyAZCgEQG0AGAXUVAwD2sPABc8AgHZ8QAD0RYArAoAcAOgCMAdgWcALJ04BOZZoBMCgDQgAnvMO7Nq5ac6b1B07oWfDAX19WqJi4hABCAIJM4SQAwhTUMQAS0QDibFy8SCCCwmKS0nIIAMxFCk5GygBsmpqGnJUKlZVWtghYhpWmqtWG6lWuupWcRer+gejY+ARMAPIppBnSOaLiUlmFlUVOvbqmlbpFulpGmi12uoaqRW7Kt-aaRfUKYyBBk4SzKTMAqmSLWcs8mtQIUsKZ1JUNPpDOZwcoFJomsozm17Jdrn07g5Hg0Xm8QqpICsJFACLAcAAjAC2on+-CEK3y60QRXh3W0nG8MM2CiKexRWFZakGiKKhjcpjq4rxEwJRLEJIIeAkGBwIjp2QZQIK8j2ZXB6h0CghRlMymuAuul3UB046iKm3thg6MuC+EJEGJpJIFAA6tQAIrfGaUDWA1Y6trY1TO0pikx1fRFAX7MrqcxNLxwkyjAKvWXu+XKqCqABuaAANngIGgFaSw1qI8y2obVLplIblK4qspnbdkzZECpXe8PV6y5Xq7XiwR2OpMvTck2QfJW+3O93Kr3jOaURCut30888-jC5666p0F7qABHHACERgAg+-1BkMUBtLpkr1GuVQKGEuy0UxWQeZFBzaUp1DbdR1F6IZrhGbwRwJclqVEOsCAgSQwFUZVSwEABrXDlUfCQRFoPAoAkMAACcACUwAAM0-RlgVkRBnEcexWU4ExXAdKoBT2aCTCqIZ7QaOpj3GN08FUNCaRETC6NogRaNUDAK1rJj1KpPDyLAcjKOoujGJYnglkbb8OIQTo1FZFQuychR22aCCwUqUTNHEu0HQAvRdH8PMJAECA4GkU88Csr92NBdxhn-QC7TMUDWQFGpLk6RoagA5QLnsFCzy9GK2MjdolCSs0UpAkx0o840tn2SVjHtTQ9BhIr5KLEk8IgCswFK7VmywLxHAOM1vBGGFalODzJU4VRwXjcwjkOC4ii6scL3LKsazrIbl1ssExSuMwXARHs+3A1osBqJxakMPkfNq+1NpPAtuvPYtLzQa87wfQaAWsuL5ERRbbk5BE+Nc8F3Nu1y2waFwGk2XY4IhLbFIw4tDpsjYAP-dsDEedMzT5AV9C6VznFMcELkqYxBmC3wgA */
  id: "swap-ui",

  context: ({ input, spawn, self }) => ({
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
    tokenList: input.tokenList,
    referral: input.referral,
    slippageBasisPoints: 100, // 1%
    depositedBalanceRef: spawn("depositedBalanceActor", {
      id: "depositedBalanceRef",
      input: {
        parentRef: self,
        tokenList: input.tokenList,
      },
    }),
    intentPoolRef: spawn("intentPoolActor", {
      id: "intentPoolRef",
      input: {
        parentRef: self,
      },
    }),
  }),

  entry: ["spawnBackgroundQuoterRef"],

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
        id: "intentSignerRef",
        src: "intentSignerActor",

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
        onDone: {
          target: "editing",
          actions: ({ context, event }) => {
            assert(event.output.tag === "ok", "non valid intent")
            const intentPoolRef = context.intentPoolRef
            intentPoolRef.send({
              type: "ADD_INTENT",
              params: {
                ...event.output.value,
                tokenIn: context.formValues.tokenIn,
                tokenOut: context.formValues.tokenOut,
                intentHash: null,
                txHash: null,
                intentDescription: null,
              },
            })
          },
          reenter: true,
        },

        onError: {
          target: "editing",
          reenter: true,
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
