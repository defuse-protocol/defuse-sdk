import { parseUnits } from "ethers"
import {
  type InputFrom,
  type OutputFrom,
  assign,
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
      | { type: "submit" }
      | { type: "startOver" },
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
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaArgSwDpI8AXPAOygGJYcAjAW1IG0AGAXUVAwHtZS8PclxAAPRAEYJADgIB2AKwA2JdIkBmVqyUKFAJgA0IAJ6S9e+UoCcc6bfV7pe1noC+ro6ky5CxMpSoKDBwSNk4kEF5+MiERcQQsABY5C1ZpRL0U9VtE9Wk7I1MEiQyCVjkKuQ1yiRUNd090bHwiCAFKAgBHHB5-agghMAIKADceAGsh7t6wAEUcMAAnPCWwkSiBWIj4rHUNAnSpPSsHBVzypULETNYy60SFdJS9BQk9JQaQL2bfNr6unp9KhLRY8RYEDAAGzQJAAZmCGACZvMlitFmsIhsYsJtogsG9EgREmkTkpFIkrKxlHIrggbncrA8nuZXm4PF8mj5Wu0oAQRmhIXgIDCKP1BsNyGNJgRvly-KK+QKhSLKAhRjwAMYioRhDHcPibHGgHaZJQEcxWFSsBwua0KWmKImqPKOF6OfKJT6ylryjr8wXCoEDchDdXS72-HmKgMqqBqyWa7XkXUScL66KCI1iPFKVgSc3SKzpaTqXRKZzqWn6eS5WzSBQuKwSSlsxreH1-BXTEiQKiiWAkGFDNCwnuLAAU3bAAAUeJDBZQAJLkMf+gCUNE5HajU4gesiBuxcTxulu0lzJUZFIkNJMknPBFUedYVmUF+U6i9W8ItEYpCD4phkMEYyvQTAkH08ZjFq2K6hw6yHpmx4ILoViPiojhWK+rCJOeEi0hIeYEGcjwvko6hXp67IgRqPAMFCYA9jQg6LCQADyIyrPBmKIVsxqIGcaG6HIlIibohb1rS5hyHc9bSFSWE2lI7jsuQPAQHAIgRghGZ8dmCTybczivjIclKBot5FLstTyHo6jlnm5YUYkHzUd+3J9DphrIVgigWMZrz5I85nZLSWAWkSWgpMScguM4JZfu2kb-EKkJgF5R64gksWEgFpnBRZDrqI+paxTIyRSGoVFtj8HldoCooZUhWXhUohINloJwugojLaARySWKZFE2DoloKIltW+ry-rKp5PG6VmJoUQQ2TmFStiqFh+RhRUBwiScmROHkGifm5SV1R0u5NXpOzKLIjj6JSCj2bo9lSWSxEuToVKli+igTVyv7gXN6beVl2QKOaiQyOWdk9foiS0icBAlG1aiZA4minTVXK0fRaU9tdi2IFUhIw21ZwlLUKQETI5qvC66i4c99wqa4QA */
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
          target: "complete",
          actions: [
            {
              type: "setOutcome",
              params: ({ event }) => event.output,
            },
          ],
        },
      },
    },

    complete: {
      on: {
        startOver: {
          target: "editing",
          actions: "clearOutcome",
        },
      },
    },
  },

  initial: "editing",
})
