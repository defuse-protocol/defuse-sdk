import { assign, fromPromise, setup } from "xstate"

// biome-ignore lint/complexity/noBannedTypes: It is temporary type, will be replaced with real quote interface
export type QuoteTmp = {}

// biome-ignore lint/complexity/noBannedTypes: It is temporary type
export type OutcomeTmp = {}

export const swapUIMachine = setup({
  types: {
    children: {} as {
      quoteQuerier: "queryQuote"
    },
    context: {} as {
      error: Error | null
      quote: QuoteTmp | null
      outcome: OutcomeTmp | null
    },
  },
  actors: {
    queryQuote: fromPromise(async (): Promise<QuoteTmp> => {
      throw new Error("not implemented")
    }),
    swap: fromPromise(async (): Promise<OutcomeTmp> => {
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
    isFormValid: () => {
      throw new Error("not implemented")
    },
    isQuoteRelevant: () => {
      throw new Error("not implemented")
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaArgSwDpI8AXPAOygGJYcAjAW1IG0AGAXUVAwHtZS8PclxAAPRAEYJADgIB2AKwA2JdIkBmVqyUKFAJgA0IAJ6S9e+UoCcc6bfV7pe1noC+ro6ky5CxMpSoKDBwSNk4kEF5+MiERcQQsPQ0CVl1pKx1pFRdDE0REuQIdABY7BTslYpctNw8QL2x8IggBAKCQ5glw7j4BWIj4rAVtAgybCWsJPSUpOSNTBIUCCTkVCYU5c3T1HfdPdEbfFv8oAjwIABswKlFYEjQSMAI0ADNHgCcACgBHHB5HgAKPAuFwoUAAkuQPgA3NAXACUNAOPmarVO5yuYREUT6wgG+SULgI0gUO1Jq3SVisuQWE2Ky1UKyk0m0TiU6j29WRTT8YIIv3+YKoECETwo0J4AGsngLHgBFHBgd54JVYiI4mJ40CDdTJaTFKR6KwOBTFTSreaIPRyVgpazFcrFTZ6BRTJSchoo3mUfl-E5UJXvHjvAgYC4PF7Bhi+-5gBVKlXvNU9aKCLVifJTelVbZKRTFKypPOWhDW23aKwO-XO121fbeJq0Rikf0i8hi8gS6UET2N+hMEgnBDingAYweabCycivU1cUQuisRRUjipw1KMxLElYEgIpvKrAy6krxWKHu5hFHPAYYbAjxo93eJAA8tDVRxsbO0-OEKal7o5ELQC0isEkS3MQpWQPBQqQcHcJHcOpyB4CA4BEXs8E-VN+m1fInCWFRAMAlQqWKHQS0SIlNArdR1xJItzwbI40Sw3EfywOROOXIiMmsStyLyBIpHpGxOP1axtGmRxGMOVETjOS4wFYud8QSTYl0ImxeNIgTaSUCwyQLJ0Vk2TYzzqDC5L5WUwWU79VMSSo9y0Q8dnwyttC3J1LBkaRjxsHQMgUGSUSbAcTjsnCMwQdRFAIPQDSycxaKsfRihLY1ljI0opjkBxNA5CyLwIK8byuR5IvTeI5AkekZBUB0DQNPMaUkGR4tddQnHUUpSXtRDXCAA */
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
        input: [
          {
            target: ".quoting",
            actions: ["clearQuote", "clearError"],
            guard: "isFormValid",
          },
          {
            target: ".idle",
            actions: ["clearQuote", "clearError"],
          },
        ],
      },

      states: {
        idle: {
          after: {
            quotePollingInterval: {
              target: "quoting",
              guard: "isFormValid",
            },
          },
        },
        quoting: {
          invoke: {
            id: "quoteQuerier",
            src: "queryQuote",

            onDone: {
              target: "idle",
              actions: assign({ quote: ({ event }) => event.output }),
            },

            onError: {
              target: "idle",
              actions: assign({
                error: ({ event }) => {
                  if (event.error instanceof Error) {
                    return event.error
                  }
                  return new Error("unknown error")
                },
              }),
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
          actions: assign({ quote: ({ event }) => event.output }),
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
