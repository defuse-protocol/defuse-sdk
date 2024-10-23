import { parseUnits } from "ethers"
import {
  type InputFrom,
  type OutputFrom,
  assertEvent,
  assign,
  emit,
  fromPromise,
  setup,
} from "xstate"
import type { SwappableToken } from "../../types"
import { isBaseToken } from "../../utils"
import type { queryQuoteMachine } from "./queryQuoteMachine"

type Children = {
  quoteQuerier: "queryQuote"
}

type Input = {
  tokenIn: SwappableToken
}

type Context = {
  error: Error | null
  quote: OutputFrom<typeof queryQuoteMachine> | null
  tokenIn: SwappableToken
  amountIn: string
  amountOut: string
  accountId: string
  recipient: string
}

type Events = {
  type: "INPUT"
  tokenIn: SwappableToken
  amountIn: string
  accountId: string
  recipient: string
  amountOut: string
}

export const withdrawMachine = setup({
  types: {
    children: {} as Children,
    input: {} as Input,
    context: {} as Context,
    events: {} as Events,
  },
  actors: {
    validation: fromPromise(async (): Promise<boolean> => {
      throw new Error("not implemented")
    }),
    queryQuote: fromPromise(
      async (_: {
        input: InputFrom<typeof queryQuoteMachine>
      }): Promise<OutputFrom<typeof queryQuoteMachine>> => {
        throw new Error("not implemented")
      }
    ),
    withdraw: fromPromise(
      async (_: {
        input: { input: Input }
      }): Promise<string> => {
        throw new Error("not implemented")
      }
    ),
  },
  actions: {
    setValues: assign({
      tokenIn: ({ event }) => event.tokenIn,
      amountIn: ({ event }) => event.amountIn,
      recipient: ({ event }) => event.recipient,
      accountId: ({ event }) => event.accountId,
    }),
    setQuote: assign({
      quote: (_, value: OutputFrom<typeof queryQuoteMachine>) => value,
    }),
    updateAmountOut: assign({
      amountOut: ({ event }) => event.amountOut,
    }),
    clearQuote: assign({ quote: null }),
    clearError: assign({ error: null }),
    emitWithdrawFinish: () => {
      throw new Error("not implemented")
    },
  },
  delays: {
    quotePollingInterval: 500,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QHcCWAXAFhATgQ2QDpINUA7KAYgEkA5ABQFUAVAbQAYBdRUABwHtYpfmR4gAHogAsAVgAchOQGYlAdgBMARiXytcmQBoQAT0QBaJZpmFtmqUoBsAThkOp7dk4C+Xo2iy4BMQQpBSEAI4Arvzo5FQQImCE5ABu-ADWSVExYACKkWA4qIUc3EggAkKxImKSCGbONk4aTjpW6jIdUkamCOoODoRK6pYjDprq7P1KUj5+GNj4RCSxYdmrVIU4-DiEvAA2eOgAZjsAthHR6HkFRSVcYpXCouV1Zur2hOojqg5KTnJ1HIpIC5D1EP1BsNLPZVKp-h8pKo5iB-Isgis4oQUnh9qgIEc4pQEmQkqkMkk0YFliENtjcfjCRQEOSAMaEkSlUqPQTPWrmTROTSKdhyeGAqTuGSC8F9KRfZpyTTOGTDJxOdiSlFUpbBUJQel4gkbYmJZJkNKZQg6jG0rE4o1MqAsi38dnVMhczRlPi8j38+qq4WWZQzFwyDUOQwmRDBrTqOGdVQeJz2by+VELal6unrSCUcSwdBHJJ4Y7XHAACjz9H4+zxFGoZArDoAlJQbTT9ZcchBueUnv7XuYQcLk3JmlH+uxVHZVLLBUpCBoZuwZEjXH9kRnO4RYJEAEZnDAmklk11W3f7o8nuIutLu1Ccrj931VJ8vUB1ZTytR-GZKiMSrdDGfRwsuqjuHIDizpo2idNqWa6piFCUAA6tQzAABIACIAEoAIJoa+FR+h+AYDOohAyOu7BwYKdjqACsqqE4y5SB8+gfP+UhRj4GZkPwEBwGInY8u+NTDvUDgJkMmihlI4aRtGvRmIp7A2DCDjsG4wzyLMO5Iba+riXyUlmDIrFyQpSk6SpI5TIQfx2GG9hyOwOiIQEyF2mE+L7GAplDl+I4cTY8nuEKrRKHIyiyu8snOfYKpuB4sVeeiXa5lccRBeR5mTAovE6KowIqJZQJgqBEwaUxHHfJuyqeBl2YoQaDqMhseWSSFCA1dRTEeTFujyfZ9Qacm3yaKKThdNKMEOC1PndnmEDdZ+EjmG0hBTD+M4ONBTgOLKvGqOFbjTUxSieM1hneUE17HugXUDmRPWbQgyjWNoUjKvJkxqEosquF8HEgr8kG6TB-FeEAA */
  id: "withdraw",

  context: ({ input }) => ({
    error: null,
    quote: null,
    tokenIn: input.tokenIn,
    amountIn: "",
    amountOut: "",
    accountId: "",
    recipient: "",
  }),

  states: {
    editing: {
      on: {
        INPUT: {
          target: ".validating",
          actions: ["clearQuote", "clearError", "setValues"],
        },

        WITHDRAW: {
          target: "submitting",
          reenter: true,
        },
      },

      states: {
        idle: {},

        quoting: {
          invoke: {
            id: "quoteQuerier",
            src: "queryQuote",

            input: ({ context }): InputFrom<typeof queryQuoteMachine> => ({
              tokensIn: isBaseToken(context.tokenIn)
                ? [context.tokenIn.defuseAssetId]
                : context.tokenIn.groupedTokens.map(
                    (token) => token.defuseAssetId
                  ),
              // TODO: For withdrawals, we don't need tokensOut since the tokenOut is the same as tokenIn.
              // Consider removing this field or adjusting the logic to reflect the withdrawal process.
              // Possible solution: Use a single token for both input and output, or implement a different structure for withdrawals.
              tokensOut: isBaseToken(context.tokenIn)
                ? [context.tokenIn.defuseAssetId]
                : context.tokenIn.groupedTokens.map(
                    (token) => token.defuseAssetId
                  ),
              amountIn: BigInt(context.amountIn),
              balances: {},
            }),

            onDone: {
              target: "quoted",
              actions: {
                type: "setQuote",
                params: ({ event }) => event.output,
              },
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
            src: "validation",

            onDone: [
              {
                target: "quoting",
                guard: ({ event }) => event.output,
              },
              {
                target: "idle",
                actions: "updateAmountOut",
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

          entry: "updateAmountOut",
        },
      },

      initial: "idle",
    },

    submitting: {
      invoke: {
        src: "withdraw",
        input: ({ context, event }) => {
          assertEvent(event, "INPUT")
          const quote = context.quote
          if (!quote) {
            throw new Error("quote not available")
          }
          return {
            input: {
              userAddress: event.accountId,
              tokenIn: context.tokenIn,
              amountIn: context.amountIn,
              amountOut: BigInt(quote.totalAmountOut),
            },
          }
        },
        onDone: {
          target: "editing.validating",

          actions: [{ type: "emitWithdrawFinish" }],

          reenter: true,
        },
      },
    },
  },

  initial: "editing",
})
