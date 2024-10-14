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
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0ArlgHSS5YB2UAxLAQEYC2uA4mBWAE4CGOYA2gAYAuolAZsOLOgpiQAD0QAWAGwBOYoIDsAVgBMenSqVqtS-QBoQAT0QGAHMXtKtKlQGYAjDp3utatXcAXyCrFAlcQhIyKSpqAGMZADMsKAJOMAARNExcADUsbgA5MG5OIVEkEAipGTlFBHcdYm89QS81QR17QUC1HStbBAcnFzcvHz8AkLCcySjSCHI4ylQCHAq5GulZKobPd0FiLXsAn2ddQK1BxDxnY51PMz0-ez0PExmQcNz8ImIYBweLEaBAZGBiJQAG7oADWEJ+83+gK4vEoUAQ0PQ8TRMgqmyq2zqe0QOiUSmIOl0eiUnjagkEKmuNkQWncKmI-Xs+ns9k8Sm0wVC3zmkX+iQoKTSnHRtAYzBw2RqBWKpXKIi2vx29UQ7OI4zMPiZ7i8pxuCAFHPc9hUnjUnl5tMEelMX0RYpIiUYqAANmA+LQcGUcAB5KFcAniLXE0ANPAHI7OToOgJtHSMvTmlS9fVmewmowOpTWt2iv4kOhMXAglUlMrUMEcSEUGHw4ju8vESsKmuFOucTEt7G4ij4jWE6O7WOIOkUzyeFSOlxNBcqTMshCLvSaXqdd5qFT6NT2ELCijoFDwKodqKayTakkIeMnUbJ05qNMZ814QwaXRPfRGUEd9i1LGoFhidE73IGMFFuNQKXeG1aQ-HlegGDdn23QwnnJNp1B0e0wN+CClhBSEID9aDainOCn1UYgkOMO1DD0HoEJUc1Hn1AJUw8JMXS0YikRIFFgSgid71ghpfE8TRCMI3pyV480lF5Jx3EMbk9C0PR+RMIThRvcVklSdIJKjKTaP2MlOQCJkBS6XpBCUc1NLkhkMxeVwEJtYSPWIL1fX9MBqIfacn3ndxiDw1xuV5AI3gwoZdEcYt006a1XGMIVZnA-5u2rdFazVMLpJnTwjmzWd+RNBcmnXIY1McfN3n5A5KpctRTyCIA */
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
          target: "generating",
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
    generating: {
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
