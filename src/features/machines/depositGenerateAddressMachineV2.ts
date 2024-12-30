import type { PreparationOutput } from "src/services/depositService"
import type { ChainType, SupportedChainName } from "src/types"
import { assert } from "src/utils/assert"
import { assign, fromPromise, setup } from "xstate"

export type Context = {
  userAddress: string | null
  userChainType: ChainType | null
  blockchain: SupportedChainName | null
  preparationOutput: PreparationOutput | null
}

export const depositGenerateAddressMachineV2 = setup({
  types: {
    context: {} as Context,
    events: {} as {
      type: "REQUEST_GENERATE_ADDRESS"
      params: NonNullable<
        Pick<Context, "userAddress" | "userChainType" | "blockchain">
      >
    },
    tags: {} as "completed",
  },
  actors: {
    generateDepositAddress: fromPromise(
      async ({
        input,
      }: {
        input: {
          userAddress: string
          userChainType: ChainType
          blockchain: SupportedChainName
        }
      }): Promise<string> => {
        throw new Error("not implemented")
      }
    ),
  },
  actions: {
    setInputParams: assign(({ event }) => {
      return {
        userAddress: event.params.userAddress,
        userChainType: event.params.userChainType,
        blockchain: event.params.blockchain,
      }
    }),
    resetPreparationOutput: assign(() => {
      return {
        preparationOutput: null,
      }
    }),
  },
  guards: {
    isInputSufficient: ({ event }) => {
      return (
        event.params.userAddress != null &&
        event.params.userChainType != null &&
        event.params.blockchain != null
      )
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcDiYAdmAE4CGOYAghBCXLALJkDGAFlsQGoBMAxACUAogEUAqkIDKAFQD6eIQDkhAqtKGyqAES3DJkgNoAGALqJQGbDizpC5kAA9EPAIwBWAHQuXAFgDsAJz+fu6hAGwANCAAnogAHGEePEYAzAFhbq5xKWlxbgC++VEolrgExOSUNHQMzOycYLyCohIy8koqahraulKGLmZIIKXWtvZOCG5xcR5xATx+ya4hcTxuUbEIWR5+YQEpfj4pa36ZBUUgJZhlRKQU1LT0sEysHNw8HjAVFJxQfBC2MAeTgAN3QAGsgVcrOU7lVHrVXg1eJ9bpVfghQegWD9bMYTPj7CMbHYhhMUkZEnMAvs3LsfGEUmF3BtECk6R4plk3DkXMy3HzCsU0Nd8Gj7tUni96u9Ud9rIQ-qQSOgSB5UAAbCgAM1VAFsPNCbvKHjVnnU3o0Pl84RisTjRoR8YShsSxmS2UY-JywoFkjyfDS-MHWQgfD4jF4eEc3GE4kcEu5ChdCOgUPAhkaxSbJYiZVaiaKSeNEHzvd5-EFg6EBZEYogALQuJLpVJxEJ+aZuIyrFJCy4imHi+Fm6WWlE29GKwtWYserb7DwpeMpFwHPzsrmhngHDw+bwhNJenjZAL9rOwyqmqUW5EfLAQDVgGe4OegCbBnweSn7aZ5ALtosobHF+wYhDGRzJC4PDJvkQA */
  context: {
    userAddress: null,
    userChainType: null,
    blockchain: null,
    preparationOutput: null,
  },

  id: "depositGenerateAddressMachineV2",
  initial: "idle",

  on: {
    REQUEST_GENERATE_ADDRESS: [
      {
        actions: ["resetPreparationOutput", "setInputParams"],
        target: "#depositGenerateAddressMachineV2.generating",
        guard: "isInputSufficient",
      },
      {
        target: "#depositGenerateAddressMachineV2.idle",
      },
    ],
  },

  states: {
    generating: {
      invoke: {
        input: ({ context }) => {
          assert(context.userAddress, "userAddress is null")
          assert(context.userChainType, "userChainType is null")
          assert(context.blockchain, "blockchain is null")
          return {
            userAddress: context.userAddress,
            userChainType: context.userChainType,
            blockchain: context.blockchain,
          }
        },
        onDone: {
          target: "idle",
          tags: ["completed"],
          actions: assign({
            preparationOutput: ({ event }) => ({
              tag: "ok",
              value: {
                generateDepositAddress: event.output,
              },
            }),
          }),

          reenter: true,
        },
        onError: {
          target: "idle",
          tags: ["completed"],
          actions: assign({
            preparationOutput: {
              tag: "err",
              value: {
                reason: "ERR_GENERATING_ADDRESS",
              },
            },
          }),

          reenter: true,
        },
        src: "generateDepositAddress",
      },
    },

    idle: {},
  },
})
