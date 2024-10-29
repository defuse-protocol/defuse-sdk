import { parseUnits } from "ethers"
import type { providers } from "near-api-js"
import { isBaseToken } from "src/utils"
import {
  type ActorRefFrom,
  assertEvent,
  assign,
  fromPromise,
  sendTo,
  setup,
} from "xstate"
import type { SwappableToken } from "../../types"
import type { DepositBlockchainEnum, Transaction } from "../../types/deposit"
import { backgroundBalanceActor } from "./backgroundBalanceActor"
import { depositGenerateAddressMachine } from "./depositGenerateAddressMachine"
import { depositNearMachine } from "./depositNearMachine"
import type { intentStatusMachine } from "./intentStatusMachine"
import type { AggregatedQuote } from "./queryQuoteMachine"
import {
  type Output as SwapIntentMachineOutput,
  swapIntentMachine,
} from "./swapIntentMachine"

export type Context = {
  error: Error | null
  balance: bigint
  nativeBalance: bigint
  formValues: {
    token: SwappableToken | null
    network: DepositBlockchainEnum | null
    amount: string
  }
  parsedFormValues: {
    amount: bigint
  }
  depositResult: SwapIntentMachineOutput | null
  intentRefs: ActorRefFrom<typeof intentStatusMachine>[]
  tokenList: SwappableToken[]
  userAddress: string
  tokenAddress: string
}

export const depositUIMachine = setup({
  types: {
    input: {} as {
      tokenList: SwappableToken[]
    },
    context: {} as Context,
    events: {} as
      | {
          type: "INPUT"
          params: Partial<{
            token: SwappableToken
            network: DepositBlockchainEnum
            amount: string
          }>
        }
      | {
          type: "SUBMIT"
          params: {
            userAddress: string
            nearClient: providers.Provider
            sendNearTransaction: (
              tx: Transaction
            ) => Promise<{ txHash: string } | null>
          }
        }
      | {
          type: "AUTO_SUBMIT"
        }
      | {
          type: "LOGIN"
          params: {
            userAddress: string
          }
        }
      | {
          type: "LOGOUT"
        },
  },
  actors: {
    formValidationBalanceActor: backgroundBalanceActor,
    depositNearActor: depositNearMachine,
    depositGenerateAddressActor: depositGenerateAddressMachine,
  },
  actions: {
    setFormValues: assign({
      formValues: (
        { context },
        {
          data,
        }: {
          data: Partial<{
            token: SwappableToken
            network: DepositBlockchainEnum
            amount: string
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
            amount: parseUnits(
              context.formValues.amount,
              context.formValues.token?.decimals ?? 0
            ),
            network: context.formValues.network,
            token: context.formValues.token,
          }
        } catch {
          return {
            amount: 0n,
            network: null,
            token: null,
          }
        }
      },
    }),
    clearError: assign({ error: null }),
    setDepositNearResult: assign({
      depositResult: (_, value: SwapIntentMachineOutput) => value,
    }),
    setDepositPassiveResult: assign({
      depositResult: (_, value: SwapIntentMachineOutput) => value,
    }),
    clearDepositResult: assign({ depositResult: null }),

    extractTokenAddress: assign({
      tokenAddress: ({ context }) => {
        if (context.formValues.token == null) {
          return ""
        }
        if (isBaseToken(context.formValues.token)) {
          return context.formValues.token.address
        }
        return (
          context.formValues.token.groupedTokens.find(
            (token) => token.chainName === context.formValues.network
          )?.address ?? ""
        )
      },
    }),
  },
  guards: {
    isDepositNearRelevant: ({ context }) => {
      return context.balance > context.parsedFormValues.amount
    },
    isBalanceSufficient: ({ event, context }) => {
      if (event.type === "SUBMIT") {
        return context.formValues.network === "near"
          ? context.balance > context.parsedFormValues.amount
          : true
      }
      return true
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0ArlgMQAyA8gOICSAcgNoAMAuoqBtjlugHZsgAPRAEZhADgB0AJgAsYgOyN5ANgDM89crEBWADQgAnojwbG07QE4xOpSrGrlAX0f6UHXIRIVK5AKoAVJlYkEHcuXn4hBDxRbQk5YVUZCxlU7QdVfSNo03MrG3k7dWdXNEwPIglIXCweKGIAZV8AIQBZakCWfjDuPhCosSl45Rkk7SlxZRHhZSzjKQcJMWEVK1VVcfkxGRKQN3L8SuquOuI6AAUAoO6D3sjjcTipbXSLFcTkqZk56JlhM3EqmEUmeUgsjHU8l2+04niqEBqpwAggFyAB9JptDrXEI9CL9ETCOLybQKRjbawg5Tyb6GYzJYRLEkKMRvRhTFTQsqwo4Ik5QCQANwAhgAbLAQYX84gQXhgCS1QXoADW8phFSw8MRApF4sl-IQivQAGMpb0gjj2Ld8aAonhLDIJIl2VsLElGKkpD88BZlEs5GsXuJEkSuWE4bACAAjAC2uGlsp48qNqok6pwtDAwoATgAlMAAM0toWtfVtiBklgkpNUKRGyisEx03tEQ3GHsYjHBkPsOxce25Gokkdj8dq9TA2ez6GzElQoqlBZnMbTg4zWbzheLeLLggryjMz2EKS22ghgyU3uUQwm-y0UnkiQssih-fTcJgSezZtOieTPCVVN00oMAvylMAkQgCBszgWB8yLLpcVLe4EBkKRJAPaYiSUBsvTpaJVAUeINg0EYLBJGRH1fUpw0qT9Jx-CcpxnOcFxwJdsxXYDQIYnAIKgmDYDgrdEKtTg7gJVCwWkGkHFsLsZgcb11gsasRk7FINimYFnH7Hh0BQeAQnfIgbnEm092iBsAVUF1WXdT1vUsOIrC0FJBmBD1VDDA44WOcczJqCy7RGIZnWpeyZA9NDvWSeQJC0IEZBGbQD0YdIfJ5TV-LqBUIFFMBAvCXc7VS+L1i2RThEozs9HwvBa3i9l0pUbQtnkX1qIHWjsr5cchTFCVGKKiTy2iBZVCdci0OUUlNm2WlshidRqykc9SWSiEPSkTKhxHOMcH5EbgsQQi4j+SwRkKbQoqBb0QUZJQkmWcigUKby3zXD8eO-I6kPMkrTuURlNPQ0lgR0EYnPJeIxAbGZBjdD1hF0xwgA */
  id: "deposit-ui",

  context: ({ input }) => ({
    error: null,
    balance: 0n,
    nativeBalance: 0n,
    formValues: {
      token: null,
      network: null,
      amount: "",
    },
    parsedFormValues: {
      amount: 0n,
    },
    depositResult: null,
    intentRefs: [],
    tokenList: input.tokenList,
    userAddress: "",
    tokenAddress: "",
  }),

  on: {
    LOGIN: {
      actions: [
        assign({
          userAddress: ({ event }) => event.params.userAddress,
        }),
      ],
    },

    LOGOUT: {
      actions: assign({
        userAddress: () => "",
      }),
    },
  },

  states: {
    editing: {
      on: {
        SUBMIT: {
          target: "submitting",
          guard: "isDepositNearRelevant",
          actions: "clearDepositResult",
        },

        INPUT: {
          target: ".validating",
          actions: [
            "clearError",
            {
              type: "setFormValues",
              params: ({ event }) => ({ data: event.params }),
            },
            "parseFormValues",
          ],
        },

        AUTO_SUBMIT: {
          target: "generating",
          reenter: true,
        },
      },

      states: {
        idle: {},

        validating: {
          entry: "extractTokenAddress",

          invoke: {
            src: "formValidationBalanceActor",

            input: ({ context }) => {
              return {
                assetAddress: context.tokenAddress,
                userAddress: context.userAddress,
                network: context.formValues.network ?? "",
              }
            },

            onDone: {
              target: "idle",
              actions: assign({
                balance: ({ event }) => event.output.balance,
                nativeBalance: ({ event }) => event.output.nativeBalance,
              }),
            },
          },
        },
      },

      initial: "idle",
    },

    submitting: {
      invoke: {
        id: "depositNearRef",
        src: "depositNearActor",

        input: ({ context, event }) => {
          assertEvent(event, "SUBMIT")

          return {
            userAddress: event.params.userAddress,
            nearClient: event.params.nearClient,
            sendNearTransaction: event.params.sendNearTransaction,
            token: context.formValues.token,
            network: context.formValues.network,
            amount: context.parsedFormValues.amount,
          }
        },

        onDone: {
          target: "editing",
        },

        onError: {
          target: "editing",

          actions: ({ event }) => {
            console.error(event.error)
          },
        },
      },
    },

    generating: {
      invoke: {
        id: "depositGenerateAddressRef",
        src: "depositGenerateAddressActor",

        input: ({ context, event }) => {
          assertEvent(event, "AUTO_SUBMIT")

          return {
            userAddress: context.userAddress,
          }
        },

        onDone: {
          target: "editing",
        },

        onError: {
          target: "editing",

          actions: ({ event }) => {
            console.error(event.error)
          },
        },
      },
    },
  },

  initial: "editing",
})

function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}
