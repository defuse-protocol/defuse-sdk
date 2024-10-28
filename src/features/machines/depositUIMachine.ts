import { parseUnits } from "ethers"
import type { providers } from "near-api-js"
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
  formValues: {
    token: SwappableToken | null
    network: DepositBlockchainEnum | null
    amount: string
    userAddress: string
  }
  parsedFormValues: {
    amount: bigint
  }
  depositResult: SwapIntentMachineOutput | null
  intentRefs: ActorRefFrom<typeof intentStatusMachine>[]
  tokenList: SwappableToken[]
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
            userAddress: string
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
        },
  },
  actors: {
    formValidationActor: fromPromise(async (): Promise<boolean> => {
      throw new Error("not implemented")
    }),
    swapActor: swapIntentMachine,
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
            userAddress: string
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
          }
        } catch {
          return {
            amount: 0n,
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

    sendToDepositedBalanceRefRefresh: sendTo("depositedBalanceRef", (_) => ({
      type: "REQUEST_BALANCE_REFRESH",
    })),
  },
  guards: {
    isDepositNearRelevant: ({ context }) => {
      return context.balance > context.parsedFormValues.amount
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0ArlgMQAyA8gOICSAcgNoAMAuoqBtjlugHZsgAPRAEZhADgB0AJgAsYgOyN5ANgDM89crEBWADQgAnojwbG07QE4xOpSrGrlAX0f6UHXIRIVK5AKoAVJlYkEHcuXn4hBDxRbQk5YVUZCxlU7QdVfSNo03MrG3k7dWdXNEwPIglIXCweKGIAZV8AIQBZakCWfjDuPhCosSl45Rkk7SlxZRHhZSzjKQcJMWEVK1VVcfkxGRKQN3L8SuquOuI6AAUAoO6D3sjjcTipbXSLFcTkqZk56JlhM3EqmEUmeUgsjHU8l2+04niqEBqpwAggFyAB9JptDrXEI9CL9ETCOLybQKRjbawg5Tyb6GYzJYRLEkKMRvRhTFTQsqwo4Ik5QCQANwAhgAbLAQYX84gQXhgCS1QXoADW8phFSw8MRApF4sl-IQivQAGMpb0gjj2Ld8aAonhLDIJIl2VsLElGKkpD88BZlEs5GsXuJEkSuWE4cdajqxRKzadZTx5UbVRJ1YdNZG6kKY-qo4aeErTeEeBbhMErZw7gTospydIPeDbKprPIvXToiszLWFM9gW8VhYoS49tyNRJYAQAEYAW1w0oTSYLKrVo5wtDAwoATgAlMAAM0toWtfVtiBklgkpNUKRGyisEx03tEQ3GHsYjHBkPsO2HabhE5nOco2IMBN03dBNwkVBRSlPcIOnVNV3XLddwPLpcWPe4EBkWtzGEFItm0CFBiUb1lCGCZ-i0KR5ESCxZCHUpw0qGBE03ON6gXBUlxTNNKDANipTAJEIAgTc4FgVDDzxE9BDPKRJFraYiSUO822yPBm3keINg0EZB20GRaMYkdmM1VjQI4kCwIgqCYJwODNwQviBMsnBhNE8TYEk-dpMw6sZDBaQaQcWwPxmBxvXWCxLxGd8Ug2KZgWcYceHQFB4BCP8iBuSsbTknIPXrZJ30KZse29Sw4isLRyMUUQQrDA4Iz5KNcpqfK7WUbQ-SkBtSo0Ft1PpQcJC0IFUmWK9DKankM1arMJVFMB2uLLD7WpCR1i2CLhCM989HbTTRvZRhtBUc6FF9Ezsvm7Vsz1DjVqrU9ogWVQnUHQLup0GjtlpDTEm019m1JHCIQ9KRZrHADZxwflns6xBQfiIlfSMkkZAhYRvRBRklCSZZByBMrofTCQLPYhGMLy2SogcRkEoU0lgR0EZKrrOQ7xmQY3Q9YQUscIA */
  id: "deposit-ui",

  context: ({ input }) => ({
    error: null,
    balance: 0n,
    formValues: {
      token: null,
      network: null,
      amount: "",
      userAddress: "",
    },
    parsedFormValues: {
      amount: 0n,
    },
    depositResult: null,
    intentRefs: [],
    tokenList: input.tokenList,
  }),

  on: {
    LOGIN: {
      actions: assign({
        formValues: ({ context, event }) => ({
          ...context.formValues,
          userAddress: event.params.userAddress,
        }),
      }),
    },

    LOGOUT: {
      actions: assign({
        formValues: ({ context }) => ({
          ...context.formValues,
          userAddress: "",
        }),
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
          invoke: {
            src: "formValidationActor",

            onDone: [
              {
                target: "idle",
                guard: ({ event }) => event.output,
              },
              "idle",
            ],
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
            userAddress: context.formValues.userAddress,
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
