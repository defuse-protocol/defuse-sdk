import { parseUnits } from "ethers"
import type { providers } from "near-api-js"
import {
  type InputFrom,
  type OutputFrom,
  assertEvent,
  assign,
  emit,
  fromPromise,
  setup,
} from "xstate"
import type { SwappableToken } from "../../types"
import type { Transaction } from "../../types/deposit"
import { isBaseToken } from "../../utils"
import type { queryQuoteMachine } from "./queryQuoteMachine"
import type { swapIntentMachine } from "./swapIntentMachine"

export const swapUIMachine = setup({
  types: {
    children: {} as {
      quoteQuerier: "queryQuote"
    },
    input: {} as {
      tokenIn: SwappableToken
      tokenOut: SwappableToken
    },
    context: {} as {
      error: Error | null
      quote: OutputFrom<typeof queryQuoteMachine> | null
      outcome: OutputFrom<typeof swapIntentMachine> | null
      formValues: {
        tokenIn: SwappableToken
        tokenOut: SwappableToken
        amountIn: string
      }
      parsedFormValues: {
        amountIn: bigint
      }
    },
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
        },

    emitted: {} as {
      type: "swap_finished"
      data: {
        intentOutcome: OutputFrom<typeof swapIntentMachine>
        tokenIn: SwappableToken
        tokenOut: SwappableToken
        amountIn: bigint
        amountOut: bigint
      }
    },
  },
  actors: {
    formValidation: fromPromise(async (): Promise<boolean> => {
      throw new Error("not implemented")
    }),
    queryQuote: fromPromise(
      async (_: {
        input: InputFrom<typeof queryQuoteMachine>
      }): Promise<OutputFrom<typeof queryQuoteMachine>> => {
        throw new Error("not implemented")
      }
    ),
    swap: fromPromise(
      async (_: {
        input: InputFrom<typeof swapIntentMachine>
      }): Promise<OutputFrom<typeof swapIntentMachine>> => {
        throw new Error("not implemented")
      }
    ),
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
      quote: (_, value: OutputFrom<typeof queryQuoteMachine>) => value,
    }),
    clearQuote: assign({ quote: null }),
    clearError: assign({ error: null }),
    setOutcome: assign({
      outcome: (_, value: OutputFrom<typeof swapIntentMachine>) => value,
    }),
    clearOutcome: assign({ outcome: null }),
    emitSwapFinish: emit(
      ({ context }, intentOutcome: OutputFrom<typeof swapIntentMachine>) => ({
        type: "swap_finished" as const,
        data: {
          intentOutcome,
          tokenIn: context.formValues.tokenIn,
          tokenOut: context.formValues.tokenOut,
          amountIn: context.parsedFormValues.amountIn,
          amountOut: BigInt(context.quote?.totalAmountOut ?? "0"),
        },
      })
    ),
  },
  delays: {
    quotePollingInterval: 500,
  },
  guards: {
    isQuoteRelevant: () => {
      // todo: implement real check for fetched quotes if they're expired or not
      console.warn(
        "Implement real check for fetched quotes if they're expired or not"
      )
      return true
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaArgSwDpI8AXPAOygGJYcAjAW1IG0AGAXUVAwHtZS8PclxAAPRAEYJADgIB2AKwA2JdIkBmVqyUKFAJgA0IAJ6S9e+UoCcc6bfV7pe1noC+ro6ky5CxMpSoKDBwSNk4kEF5+MiERcQQscwAWAiV1JIUrNUUbVgcjUwTHWVs9OVYJBSl1OQk3DxAvbHwiCAFKAgBHHB5-agghMAIKADceAGsh7t6wAEUcMAAnPCWwkSiBWIj4rHUNAmkkqT0rBwUkzTklAsQy1gJtKwzDuXMqvSV3T3Rm3za+ro9PpUJaLHiLAgYAA2aBIADNwQxATN5ksVos1hENjFhNtEFg6ikkqxpKclIoklZWMo5DcEHcHtZnklXnp3l9Gj8fK12lACCM0FC8BBYRR+oNhuQxpMCE1uX4xfzBcLRZQEKMeABjUVCMKY7h8Ta40A7MpKAjmKwqPLOZzqBR0xQEJKqdROJz6aRepIcuUtBUdAVCkXAgbkIYamV+v68pXB1VQdVSrU68h6iThA3RQTGsT4pQVC2kw7Se3KO10-TyC62aQKFxWCRU+rfbz+-6K6YkSBUUSwEiwoZoOHdxYACi7YAACjwoULKABJcijoMAShoXPbscnEH1kUNOLi+N092kBYklKSlIktJMkjPqWkFVYVmU5+U6l9m8ItEYpFDEqRkM0ayvQTAkH0SZjNqOJ6hw6wHjmIiFKcBAXkoSRqGUDiaOoRjxGkJRyOUMiYZk+ifhy5A8BAcAiNGCHZlsJr4k+9zOK+Mh1meGi3oUWAuuozqOPocjqNYVQVF+bYxn0jFGkeCSKBYHFVF6Cg8TUdK7FcaHUkoF5XqwRkqNJvw8gCwpQmA8mHniSnGRaL5qdxBlaXeCBiak9okS8UhqD6DQgQGfJdmKtlIfZiQYQQ9ZaKcbpsk82h0heciWFx6hWDYOhWgoZnyh2gbKiG4VYohzF5kUWUEDU5jUrYqjZV62nEQccjZQ4pRuholGtuZIXIt2EARZVOzKLIIknNS4m6OJdIfOl5wqPWCj2i+igFS0v7gXJ5VMbm8Q1AoFpHGe5j2q+ehJHSqHoZhdRiXouHuO4QA */
  id: "swap-ui",

  context: ({ input }) => ({
    error: null,
    quote: null,
    outcome: null,
    formValues: {
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut,
      amountIn: "",
    },
    parsedFormValues: {
      amountIn: 0n,
    },
  }),

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
            "clearError",
            {
              type: "setFormValues",
              params: ({ event }) => ({ data: event.params }),
            },
            "parseFormValues",
          ],
        },
      },

      states: {
        idle: {},

        quoting: {
          invoke: {
            id: "quoteQuerier",
            src: "queryQuote",

            input: ({ context }): InputFrom<typeof queryQuoteMachine> => ({
              tokensIn: isBaseToken(context.formValues.tokenIn)
                ? [context.formValues.tokenIn.defuseAssetId]
                : context.formValues.tokenIn.groupedTokens.map(
                    (token) => token.defuseAssetId
                  ),
              tokensOut: isBaseToken(context.formValues.tokenOut)
                ? [context.formValues.tokenOut.defuseAssetId]
                : context.formValues.tokenOut.groupedTokens.map(
                    (token) => token.defuseAssetId
                  ),
              amountIn: context.parsedFormValues.amountIn,
              balances: {}, // todo: pass through real balances
            }),

            onDone: {
              target: "quoted",
              actions: {
                type: "setQuote",
                params: ({ event }) => event.output,
              },
              reenter: true,
            },

            onError: {
              target: "quoted",

              actions: assign({
                error: ({ event }) => {
                  if (event.error instanceof Error) {
                    return event.error
                  }
                  return new Error("unknown error")
                },
              }),

              reenter: true,
            },
          },
        },

        validating: {
          invoke: {
            src: "formValidation",

            onDone: [
              {
                target: "quoting",
                guard: ({ event }) => event.output,
              },
              {
                target: "idle",
                actions: "updateUIAmountOut",
              },
            ],
          },
        },

        quoted: {
          after: {
            quotePollingInterval: {
              target: "quoting",
              reenter: true,
            },
          },

          entry: "updateUIAmountOut",
        },
      },

      initial: "idle",
    },

    submitting: {
      invoke: {
        src: "swap",

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
          target: "editing.validating",
          actions: [
            { type: "setOutcome", params: ({ event }) => event.output },
            { type: "emitSwapFinish", params: ({ event }) => event.output },
          ],
        },

        onError: {
          target: "editing.validating",
          actions: ({ event }) => {
            console.error(event.error)
          },
        },
      },
    },
  },

  initial: "editing",
})
