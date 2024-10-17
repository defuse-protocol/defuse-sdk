import { parseUnits } from "ethers"
import {
  type InputFrom,
  type OutputFrom,
  assign,
  emit,
  fromPromise,
  setup,
} from "xstate"
import type { BaseTokenInfo } from "../../types/base"
import type { swapIntentMachine } from "./swapIntentMachine"

export type QuoteTmp = {
  amount_out: string
}

export const swapUIMachine = setup({
  types: {
    children: {} as {
      quoteQuerier: "queryQuote"
    },
    input: {} as {
      tokenIn: BaseTokenInfo
      tokenOut: BaseTokenInfo
    },
    context: {} as {
      error: Error | null
      quotes: QuoteTmp[] | null
      outcome: OutputFrom<typeof swapIntentMachine> | null
      formValues: {
        tokenIn: BaseTokenInfo
        tokenOut: BaseTokenInfo
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
            tokenIn: BaseTokenInfo
            tokenOut: BaseTokenInfo
            amountIn: string
          }>
        }
      | { type: "submit" },

    emitted: {} as {
      type: "swap_finished"
      data: {
        intentOutcome: OutputFrom<typeof swapIntentMachine>
        tokenIn: BaseTokenInfo
        tokenOut: BaseTokenInfo
        amountIn: bigint
        amountOut: bigint
      }
    },
  },
  actors: {
    formValidation: fromPromise(async (): Promise<boolean> => {
      throw new Error("not implemented")
    }),
    queryQuote: fromPromise(async (): Promise<QuoteTmp[]> => {
      throw new Error("not implemented")
    }),
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
            tokenIn: BaseTokenInfo
            tokenOut: BaseTokenInfo
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
    clearQuote: assign({ quotes: null }),
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
          amountOut: BigInt(context.quotes?.[0]?.amount_out ?? "0"),
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
    quotes: null,
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

            onDone: {
              target: "quoted",
              actions: assign({ quotes: ({ event }) => event.output }),
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

        input: ({ context }) => {
          const quote = context.quotes?.[0]
          if (!quote) {
            throw new Error("quote not available")
          }

          return {
            tokenIn: context.formValues.tokenIn,
            tokenOut: context.formValues.tokenOut,
            amountIn: context.parsedFormValues.amountIn,
            amountOut: BigInt(quote.amount_out),
          }
        },

        onDone: {
          target: "editing.validating",

          actions: [
            { type: "setOutcome", params: ({ event }) => event.output },
            { type: "emitSwapFinish", params: ({ event }) => event.output },
          ],

          reenter: true,
        },
      },
    },
  },

  initial: "editing",
})
