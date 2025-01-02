import type { PreparationOutput } from "src/services/depositService"
import type { SupportedChainName } from "src/types/base"
import type { ChainType } from "src/types/deposit"
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
  },
  actors: {
    generateDepositAddress: fromPromise(
      async (_: {
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
      if (
        event.params.blockchain === "near" ||
        event.params.blockchain === "turbochain" ||
        event.params.blockchain === "aurora"
      ) {
        return false
      }
      return (
        event.params.userAddress != null &&
        event.params.userChainType != null &&
        event.params.blockchain != null
      )
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcDiYAdmAE4CGOYAghBCXLALJkDGAFlsQGoBMAxACUAogEUAqkIDKAFQD6eIQDkhAqtKGyqAES3DJkgNoAGALqJQGbDizpC5kAA9EPAIwBWAHQuXAFgDsAJz+fu6hAGwANCAAnogAHGEePEYAzAFhbq5xKWlxbgC++VEolrgExOSUNHQMzOycYLyCohIy8koqahraulKGLmZIIKXWtvZOCG5xcR5xATx+ya4hcTxuUbEIWR5+YQEpfj4pa36ZBUUgJZhlRKQU1LT0sEysHNw8HjAVFJxQfBC2MAeTgAN3QAGsgVcrOU7lVHrVXg1eJ9bpVfghQegWD9bMYTPj7CMbHYhhMUkZEnMAvs3LsfGEUmF3BtECk6R4plk3DkXMy3HzCsU0Nd8Gj7tUni96u9Ud9rIQ-qQSOgSB5UAAbCgAM1VAFsPNCbvKHjVnnU3o0Pl84RisTjRoR8YShsSxmS2UY-JywoFkjyfDS-MHWQgfD4jF4eEc3GE4kcEu5ChdCOgUPAhkaxSbJYiZVaiaKSeNEHzvd5-EFg6EBZEYogALQuJLpVJGdJ7MI8abxoWXEUw8Xws3Sy0om3oxWFqzFj1bfYeFLxlIuA5+dlc0M8A4eHzeEJpL3dtJ9rOwyqmqUW5EfFjoPWasCUCDT3Cz0DkvyRoxGHn0nw8HsASUqGdIzDkRguAevopBGPCngOxpwpeeZjh8WAQBqYCvo6JYIIcAS7jGkEMisayhkESTRi4RhLLRjK+sm+RAA */
  context: {
    userAddress: null,
    userChainType: null,
    blockchain: null,
    preparationOutput: null,
  },

  id: "depositGenerateAddressMachineV2",

  on: {
    REQUEST_GENERATE_ADDRESS: [
      {
        actions: ["resetPreparationOutput", "setInputParams"],
        target: ".generating",
        guard: "isInputSufficient",
      },
      ".completed",
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
          target: "completed",
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
          target: "completed",
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

    completed: {},
    idle: {},
  },

  initial: "idle",
})
