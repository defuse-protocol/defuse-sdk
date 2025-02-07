import type { providers } from "near-api-js"
import {
  type ActorRefFrom,
  and,
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
import { intentPoolMachine } from "./intentPoolMachine"
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
    // biome-ignore lint/suspicious/noExplicitAny: Remove `any` once you figure out how to properly type the machine to resolve TypeScript error TS7056 (can't assign machine to actor)
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
      ({ context }: { context: Context }): BackgroundQuoterEvents => {
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

    sendToIntentPoolRefAddIntent: sendTo("intentPoolRef", ({ context }) => {
      assert(context.intentSignResult !== null, "intentSignResult is null")
      assert(
        context.intentSignResult.tag === "ok",
        "intentSignResult is not ok"
      )
      const intent = context.intentSignResult.value

      return {
        type: "ADD_INTENT",
        params: {
          ...intent,
          tokenIn: context.formValues.tokenIn,
          tokenOut: context.formValues.tokenOut,
        },
      }
    }),
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
    isOptimisticBalanceUpdatesEnabled: () => settings.optimisticBalanceUpdates,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaArgSwGIBJAOQBUBRcgfQGUKyyAZCgEQG0AGAXUVAwD2sPABc8AgHZ8QAD0RYAzAHZOAOk5KlATgAsADmUA2AKwbjxgDQgAnvK16ATKoUOdO4wq0PDARmV6AXwCrVExcQgAhAEEmKJIAYQpqeIAJOIBxNi5eJBBBYTFJaTkEYy9VBzKHL2N3Hx1fK1sELC1DPVU9HW1OboMehyCQ9Gx8AiYAeXTSbOl80XEpXJLqnVUdBz0tTQUdLVqHByUmu3bO7t1HBr1zBSGQUNHCSfSJgFUyWdz5wqXQEqwDh8qjKnCOui0nGMSmUSj0JxabQ6XW0+lc7Vu90e4VUkAWEigBFgOAARgBbURffhCBZFZaIZRObbQhQ+XrbSoOBFYBqGCq9Uw+G4KYx6JQ+LEjHF4sQEgh4CQYHAiKl5Gm-YryaqqJSVfaOBSGDS6rk2eQKPRqFm7XXuS2+O7BB5S-C4iD4wkkCgAdWoAEU3hNKKqfotNS0HJw+ZwbmVLXs2qLTc0sCZo2KlLVDcZKtpJWFXTKFVBVAA3NAAGzwEDQssJIfVYfpLWhzkM3iU7ajDR0Ue52vM-U4PiUOgULhjjuGBbwbo9Zcr1drxYI7B8OWpBSb-y1vlU23jhgarLZUIRTkzmcNFvM3Q0+aec7rqnQHuoAEccAIRGACF7fQGQYUA2W50juLbapwGgjoavQ+IYCjnlBIKcFohpaGyxgIZmxgPjixLkqIdYEBAkhgKoCqlgIADW5EKj+EgiLQeBQBIABKYAAGYgbSfyyIgKgdAovTtrqPgOMJ4r9ghqi+DoPgYQhUH6LoeGugRFIiMRpESHREhUbRFGMWAjHMaxHHceucyNmB-EIHoMkbGy+iGHCGHQgiZwqGJXispo0K4U62LqaSmnaWRRkGXpDFMSx7FcewDgbmqoF8SUuzAiKx6duKOaeIYCKOKoQr+Ky+z7KYShqbOGlESuYAAE4NQIDWqBgFa1pxLVkkZMVmfF3E8NZqXhp4HS6FGw4IRs4rwmaLQigoIIGFCrnjiiVVBS6NWhXVcr-v6gbBkN3w2WlAm6uo4muGCEmZme82ppUxUitUPg+OYbS9NVqgks1aAQAAxmgsDEY1zWte1nXdb1JkiBE-1AyDIgWTxGrNhawIaLsw6dpaegOeeObODBKKuGOs0-YIAgVquJ2brx4ZuHyDnYZwyg2m03KGFonSbGKyneV0OhBE6EgCBAcDSMFeDDYzzZPcY6jQTCRryQh3I9MtOyZm42htD9RYEnL6PgVg0JKMr4qq3BGuPcYH3qDCLg87UlUSltM5PsWFEQBWYAm9udmKEVl4jtCYI5hsljzVaGh7DzhhrW0JiBJ7j5GyW5ZVjWdaB7ZJT6MVdSsoark834Mcpu9fJ+O99S6GUmhdIb7rPq+dYfl+P75+dCAuBUrLdmK6t6O957tus7amIcuUeEnP21Vpxa9+G7RLYaKi6O0Y+bIhj28jq4KMvBo6+Jt06Pn9AgA8DoMr6dI3NmPtejkiZRYW0PhE2o1SeK9RptAqBFunHE1MKyr2bO0S2vZDjiRzO2IU39HpsmBATVymxRzeApo6IIQA */
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
    intentRefs: [],
    tokenList: input.tokenList,
    referral: input.referral,
    slippageBasisPoints: 100, // 1%
    intentSignResult: null,
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
            target: "pool",
            guard: and([
              ({ event }) => event.output.tag === "ok",
              { type: "isOptimisticBalanceUpdatesEnabled" },
            ]),

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

    pool: {
      entry: ["sendToIntentPoolRefAddIntent"],
      target: "editing",
      exit: ["clearIntentSignResult"],

      always: {
        target: "editing",
        reenter: true,
      },
    },
  },

  initial: "editing",
})
