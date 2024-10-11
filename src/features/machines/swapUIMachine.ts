import { assign, fromPromise, setup } from "xstate"
import type { Output } from "./swapIntentMachine"

// biome-ignore lint/complexity/noBannedTypes: It is temporary type, will be replaced with real quote interface
export type QuoteTmp = {}

export const swapUIMachine = setup({
  types: {
    children: {} as {
      quoteQuerier: "queryQuote"
    },
    context: {} as {
      error: Error | null
      quote: QuoteTmp | null
      outcome: Output | null
    },
  },
  actors: {
    formValidation: fromPromise(async (): Promise<boolean> => {
      throw new Error("not implemented")
    }),
    queryQuote: fromPromise(async (): Promise<QuoteTmp> => {
      throw new Error("not implemented")
    }),
    swap: fromPromise(async (): Promise<Output> => {
      throw new Error("not implemented")
    }),
  },
  actions: {
    clearQuote: assign({ quote: null }),
    clearError: assign({ error: null }),
    clearOutcome: assign({ outcome: null }),
  },
  delays: {
    quotePollingInterval: 500,
  },
  guards: {
    isQuoteRelevant: () => {
      throw new Error("not implemented")
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaArgSwDpI8AXPAOygGJYcAjAW1IG0AGAXUVAwHtZS8PclxAAPRAEYJADgIB2AKwA2JdIkBmVqyUKFAJgA0IAJ6S9e+UoCcc6bfV7pe1noC+ro6ky5CxMpSoKDBwSNk4kEF5+MiERcQQsfSsCABZWdQUJOQl06WkU6SNTBIVZVgkFFIqUhXtWFPV3T3RsfCIIAUoCAEccHhJIKlFYEjQBgjQAMwGAJwAKXv6wAAUeABs1iigASXJZgDc0NYBKGhafds6oHr6BiDCRKIFYiPjEhVYCaSVylKsUv5ZIqSb4EVTlVhWZQ-CpKRoeEBeVq+Dr+a6LNFUCBCMAECj7HgAa1xGLAAEUcGAZngqQ8Ik8YsJXogsOoNF8qhI9FYHJVNHIlMCEHo5J9tP9Sik5OZMnolE1Eec2n4tjd+lsqFSZjwZgQMGsxpMdQw1QMKVSaTM6dw+M8maA3lyUqlWNIeUpFH9WMo5EKRWLrDV8tK9LKFUiLrRGKRMdjyLj8UTcRG2lGmCQ0QhEwBjMaCchha2RW2MuKIXTJFRKRxWKH1b4SIU5CQESqlSFw-4A8NKwjZngMfVgAY0UYzEgAeX2tI4jxL+bLCEqyV0cisrDXujd0gUfpFBG0O+k3trDnKEh73mVqNVh02EDzATjCfIBOJBBTKKuBDveAfmZzPMhELWd6XnF4HRZEUlAIcwrBUdJnGcDIhUUVJVHUJwnH0PJ8kvZFLjRH8jj-R9qGfPFXyTD9e0I28SP-LYsyo3NGULCRwhtaIF2ZEo1FbRw9E0PIXD0KRUIUdD8nqUN1ClTJ5QVcgeAgOARE-OduIgsQWWPT5nChGQjyUDRfRMKCHDBEy5WlN0t3SfCLhVShNLtRcsEUCwDMyPJShM9QzOKLAJBqAh1EwuTTPUQNzEc69vz-NYwFc0teI8+pYMhHzjNM1D1DBDJRRkKUpDUFI4q-IiMS2FKeMghI5WdD4tB5TDQ3+bQmylSwjPUWsBQUeCFAqj96HTNFau0+IAskvQqm+cwMihOahR5AgQqUAouTkBxNHhZorz7AchwGSb7R0hBsmdGQVBqKoqg9QxzIQUrYMyNq5J3aL-hG5zrl-RiXLArTzreITkhu+DHByOTrEKZ7EgsD07A0c8MjsaRfpvLpSQgM73MySSTKyeCrA0Bw7D9Jx1oChwJBsTa0mkeF3CAA */
  id: "swap-ui",

  context: {
    error: null,
    quote: null,
    outcome: null,
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
          actions: ["clearQuote", "clearError"],
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
              actions: assign({ quote: ({ event }) => event.output }),
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
              "idle",
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
        },
      },

      initial: "idle",
    },

    submitting: {
      invoke: {
        src: "swap",
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
