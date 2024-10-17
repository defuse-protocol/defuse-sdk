import { parseUnits } from "ethers"
import { type InputFrom, assign, fromPromise, setup } from "xstate"
import type { BaseTokenInfo } from "../../types/base"
import type { Output, swapIntentMachine } from "./swapIntentMachine"

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
      outcome: Output | null
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
      }): Promise<Output> => {
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
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaArgSwDpI8AXPAOygGJYcAjAW1IG0AGAXUVAwHtZS8PclxAAPRAEYJADgIB2AKwA2JdIkBmVqyUKFAJgA0IAJ6S9e+UoCcc6bfV7pe1noC+ro6ky5CxMpSoKDBwSNk4kEF5+MiERcQQsABZrAiV1CXt1dSUJBQlEo1ME6SsCLIyFbKsJJT0FVgl3T3RsfCIIAUoCAEccHn9qCCEwAgoANx4AaxHe-rAARRwwACc8FbCRKIFYiPisdPUCaUSpPSsHBUTNOSVCxD05VgJtK0SFY7lzPL0lJpAvVq+DoDHp9AZUFbLHjLAgYAA2aBIADNoQxQXNFis1ssNhEtjFhLtEFgJHpEgREqwStlFIkrKxlHI7ggHk8Xm8Pl9SX8AT52p0oAQxmg4XgIIiKINhqNyBNpgReW0-JKhSKxRLKAhxjwAMYSoRhXHcPjbQmgPYPJQEcxWFSsBwue0KZmKCmqdROJz6aQ+xI8lp85VdYWi8XgobkEba+WKoEC1WhjVQLWy3X68iGiThY3RQRmsTEpQNa0lY7SdS6Wr25n6eRXWzSepnCT0twef4BpXAlWzEiQKiiWAkREjNBIvvLAAUvbAAAUeHDRZQAJLkCchgCUNE7cZBM4gRsiJoJcWJuie0iL+VedIyzJkVtUDVYVmUV+U6n93jatEYpHD0rRiMsYKvQTAkAMKYTHqBKGhwmzHnmp4ILopQqLUJSvqwiSXhI97Fpc7wvmkN5+u2IE6jwDDwmAfY0MOywkAA8mM6zwXiiE7OaiCXKUuhyPSAm6KWzomPcDzPKoREKFY5zOFI7jtuQPAQHAIixghuZcQWxRaNaL55D67w5OoTJiQkPyHDYNzaBI2EtlSZHNN+u6SppprIVgigWM4r4yI2uGmcyJI3KklxKAJJQCawAmfuRO78iCYpwmA7knkSCSPOSvmGQFJlmUUciHGkCiPDIiRyFIahOR2LmJT2YJuRxWn5haSjkvUWjnB6dSvNo94VZY-nqLJNwyToX6AvVwZqmGTU5h5GVYHoI1lJ8zilZemE+sFchyEcAlybYK1qFkk2Bt2XT7mlSFLcosiOPo9KVDoL3Mj8+3hToDIVi+ijnT+YH-vNR4tchpkKNaJyXuYFavmSzLnAQ+TtWoDwOJocXOVNlHUSlfY3dp8SVeSD7tZc+Q1J894yNaeQ9eoOEva8imuEAA */
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
          actions: assign({ outcome: ({ event }) => event.output }),
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
