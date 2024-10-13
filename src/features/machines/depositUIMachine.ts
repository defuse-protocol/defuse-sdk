import { assign, fromPromise, setup } from "xstate"

type Output = {
  receipt: string
}

export const depositUIMachine = setup({
  types: {
    context: {} as {
      error: Error | null
      outcome: Output | null
      blockchain: string | null
      asset: string | null
      amount: string | null
    },
  },
  actors: {
    generate: fromPromise(async (): Promise<Output> => {
      throw new Error("not implemented")
    }),
    depositViaNear: fromPromise(async (): Promise<Output> => {
      throw new Error("not implemented")
    }),
  },
  actions: {
    clearOutcome: assign({ outcome: null }),
    clearDeposit: assign({ blockchain: null, asset: null, amount: null }),
    clearError: assign({ error: null }),
  },
  guards: {
    isBlockchainValid: () => {
      throw new Error("not implemented")
    },
    isConfigurationValid: () => {
      throw new Error("not implemented")
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0ArlgHSS5YB2UAxLAQEYC2uA4mBWAE4CGOYA2gAYAuolAZsOLOgpiQAD0QBOAKzElAdgBMANgDMARgMAWAByCtWgyoA0IAJ6IDq4oO1KdpnUY0aVGnQBfQLsUCVxCEjIpKmoAYxkAMywoAk4wABE0TFwANSxuADkwbk4hUSQQcKkZOUUEY2MNYhVBNoMdHS12pT07RwRnNTctDy8fPwDg0OzJSNIIcljKVAIccrlq6VlK+oM9QWINUyVVFVMmlV6NfsQ8C6OVAw1jLT1j3T1jJWmQMJz8ERiDAOOkYjQIDIwMRKAA3dAAa2h-zmQJBXDA4IQcPQcV423KG0qW1quycGgMxCauk8BjaeiUWhuDkQ3kpzzMphUKiapmsxl+KIiQISFGSqU4lBodCYuCy1XyRRKZREmwB2zqiEaSlcPiZpj5KiZelsLIaRmIumOBoMox0Tx+IT+s2FJASjFQABtMWBaDhSjgAPKwrhE8Tq0mgep4faHC5KQQGE6MwStLq3BA6QQ6nQvUx6E3eC56UyCl2Akgy5g4cGK4qlaiQjgwijwpHEIUV4hV3C1gr1zjY1u4-EyQmq4kRnZRxAqPQ6Kk6MyNA6NFS5jPaBdGr76VP7PS6YJOijoFDwSqdyJqyQaskIGPHYjxxPJ7pprQZvBaK6PZ5MrQuQ0NxBD0MtqnmaIpRvchIwUO4lGMS1PCXZwf0A7NTQGR8tEtJ4NC+fNnC5I8nSvIEoKoGEIG9GCamneCH2MBddC8Yw0KNcxEJ0DMnmIHRTlOT541GDRwIBeZ0TBaDJ1vOC9n8dR-FAilBHtSxBFMDNDD0KkrFTJc5wZY5xNRN0khSNIZPDOSGPqddcILIst3MYCsMQQxDmA15D1MXQlFtLxTNdYh3S9H06LvGcHyMXTGiZTxzmTPz3IQPxTCpE1s1A0wAiXMCyPLeYexrKU62VSL5NnSx1G+bpfG8HlRl4wDLWOYxD3SnyCuCIA */
  context: {
    error: null,
    blockchain: null,
    outcome: null,
    asset: null,
    amount: null,
  },
  id: "deposit-ui",
  initial: "editing",
  states: {
    editing: {
      initial: "idle",
      on: {
        submitGenerate: {
          target: "genereting",
          guard: {
            type: "isBlockchainValid",
          },
        },
        configureDepositViaNear: {
          target: "configuring",
          guard: {
            type: "isBlockchainValid",
          },
        },
        input: {
          target: "#deposit-ui.editing.idle",
          actions: [
            {
              type: "clearDeposit",
            },
            {
              type: "clearError",
            },
          ],
        },
      },
      states: {
        idle: {},
      },
    },
    genereting: {
      invoke: {
        id: "swap-ui.submitting:invocation[0]",
        input: {},
        onDone: {
          target: "complete",
          actions: assign({ outcome: ({ event }) => event.output }),
        },
        src: "generate",
      },
    },
    configuring: {
      on: {
        submitDepositViaNear: {
          target: "submittingViaNear",
          guard: {
            type: "isConfigurationValid",
          },
        },
      },
    },
    complete: {
      on: {
        startOver: {
          target: "editing",
          actions: {
            type: "clearOutcome",
          },
        },
      },
    },
    submittingViaNear: {
      invoke: {
        input: {},
        onDone: {
          target: "complete",
          actions: assign({ outcome: ({ event }) => event.output }),
        },
        src: "depositViaNear",
      },
    },
  },
})
