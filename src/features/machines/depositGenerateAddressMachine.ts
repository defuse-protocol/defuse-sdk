import { fromPromise, setup } from "xstate"

// biome-ignore lint/complexity/noBannedTypes: It is temporary type
type Context = {}

// biome-ignore lint/complexity/noBannedTypes: It is temporary type
type Input = {}

// biome-ignore lint/complexity/noBannedTypes: It is temporary type
export type Output = {
  // todo: Output is expected to include intent status, intent entity and other relevant data
}

export const depositGenerateAddressMachine = setup({
  types: {
    context: {} as Context,
    input: {} as Input,
    output: {} as Output,
  },
  actors: {
    generateDepositAddress: fromPromise(async (): Promise<string> => {
      throw new Error("not implemented")
    }),
  },
}).createMachine({
  context: ({ input }: { input: Input }) => {
    return {
      depositRef: null,
    }
  },
  id: "deposit-generate-address",
  initial: "generating",
  description:
    "Handle initializing a new deposit procedure.\n\nResult \\[Branching\\]:\n\n1. Network base direct deposit (Near, Ethereum, etc.);\n2. Indirect deposit via POA bridge;",
  states: {
    generating: {
      invoke: {
        input: {},
        onDone: {
          target: "#generate_deposit_address.generating.Genereted",
        },
        src: "generateDepositAddress",
      },
      description: "Generate deposit address via POA bridge",
      states: {
        Genereted: {
          type: "final",
        },
      },
    },
  },
})
