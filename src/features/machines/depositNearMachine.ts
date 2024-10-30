import { DepositBlockchainEnum, type SwappableToken } from "src/types"
import { isBaseToken } from "src/utils"
import { assign, emit, fromPromise, setup } from "xstate"

export type Context = {
  amount: bigint | null
  asset: SwappableToken | null
  tokenAddress: string | null
  accountId: string | null
  txHash: string | null
  balance: bigint | null
  error: string | undefined
  outcome: unknown | null
}

type Events = {
  type: "INPUT"
  balance: bigint
  amount: bigint
  asset: SwappableToken | null
  accountId: string
}

type Input = {
  balance: bigint
  amount: bigint
  asset: SwappableToken | null
  accountId: string
}

export type Output =
  | {
      status: "SUCCESSFUL"
      txHash: string
    }
  | {
      status: "FAILED"
      error: string
    }

export const depositNearMachine = setup({
  types: {} as {
    context: Context
    events: Events
    input: Input
    output: Output
  },
  actors: {
    signAndSendTransactions: fromPromise(
      async ({ input }: { input: Input }): Promise<string> => {
        throw new Error("not implemented")
      }
    ),
    validateTransaction: fromPromise(
      async ({
        input,
      }: {
        input: { txHash: string; accountId: string; amount: bigint }
      }): Promise<boolean> => {
        throw new Error("not implemented")
      }
    ),
  },
  actions: {
    emitSuccessfulDeposit: emit(({ context }) => ({
      type: "SUCCESSFUL_DEPOSIT",
      data: context.txHash,
    })),
    emitFailedDeposit: emit(({ context }) => ({
      type: "FAILED_DEPOSIT",
      error: context.error,
    })),
  },
  guards: {
    isDepositValid: () => {
      throw new Error("not implemented")
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0AdmAIYBOAdFhADZgDEAkgHIAKAqgCoDaADALqJQGbDizoCgkAA9EAVgDss8gGZ5AFgAcsjQCZ5ANgCcPAIyGANCACeiPDrWHya+TsMm1PfRv3LD6gL7+lijCuIQkFNhQBFgEUHQQ4mCUBABu6ADWySGYYURk5FExcQix6QDGxKLivHy1kqHVEkjSiPo6POSu3g728sbKapY2CDpKOh0aJhoaavam8gaBwWi5+PmRWNGx8WCkpOgUqNRVAGaHALbkOSLhBUU7pWnolU219S2NYs2gMgjKRnIAw0hg0Bjcnn0w0QYy6k2ms3mJkWyxANzyEXIqT2WFOVh2CSSKXSWWuq1uGyxOLxjzKLyq33e-Aaa2+kj+Jh49nIPl0hgBhjU+k00NG3h5GkGRimslMhlkqPR60x2NIuPxcToewORxOOHOpCuSruFFV6tpz1ejP4HyErPE7MQBn0XUGsjGWh4c2UGlFOnFXkGHXd02R+gVQTR5IxBQARgdiBBKrBRJqAKLYgg4AAEJltIC+DpaHNk7nIXu8nNk8pMyhMslFmhMKgU4fkWh00wUgUjBHQKHgLWNGxZIjZxcQyh48icPEMwu0+iM-SG1lsygBQJcbmlXo8GkV0eVBSotFHuHHv0nsiUHnnakXy8ForsPp5al8QvDak59cPjRNQotmKKBzyaR0EE0HRyEWZRXABYVBQBF8TDMch6w6Mw9E5SUHH-NZALNGk4jAy9WgQSVOm8eVpRvQUeGUUUTGFLohRBNQOOUUtTDUfCKUxABBWNDhwSBSKLK9IJ0F0XCmZjTC9JcGzXUYy36H0PFUAV7GUPiYwoeN0ETZNU1Az57R+cj3A6ct9AYoxDH5AEdD9dQYO0LQOLcB8pj048KCYdAcwAMXQABXAgIGzQ5swYNJiGoKhxMsv4DE6QZFklDQvQUVRGx0ZRyBDasQX6OzJXkPzAIAYXQC5jjAUSIGSiD3FmdCQTGHhPEmeRRVy8g5J4G9P30DCe38IA */
  id: "deposit-near",

  initial: "signing",

  output: ({ context }): Output => {
    if (context.txHash != null) {
      return {
        status: "SUCCESSFUL",
        txHash: context.txHash,
      }
    }
    if (context.error != null) {
      return {
        status: "FAILED",
        error: context.error,
      }
    }

    throw new Error("Unexpected output")
  },

  context: ({ input }) => {
    return {
      balance: input.balance,
      amount: input.amount,
      asset: input.asset,
      accountId: input.accountId,
      txHash: null,
      error: undefined,
      outcome: null,
      tokenAddress: null,
    }
  },
  states: {
    signing: {
      invoke: {
        id: "deposit-near.signing:invocation[0]",

        input: ({ context }) => {
          return {
            balance: context.balance || 0n,
            amount: context.amount || 0n,
            accountId: context.accountId || "",
            asset: context.asset || null,
          }
        },
        onDone: {
          target: "verifying",
          actions: assign({
            txHash: ({ event }) => event.output,
          }),
        },
        onError: {
          target: "Aborted",
          actions: assign((context) => ({
            ...context,
            error: "Signing error",
          })),
        },
        src: "signAndSendTransactions",
      },
    },

    verifying: {
      invoke: {
        id: "deposit-near.verifying:invocation[0]",
        input: ({ context }) => ({
          txHash: context.txHash || "",
          accountId: context.accountId || "",
          amount: context.amount || 0n,
        }),
        onDone: {
          target: "broadcasting",
          guard: {
            type: "isDepositValid",
          },
        },
        onError: {
          target: "Not Found or Invalid",
        },
        src: "validateTransaction",
      },
    },

    broadcasting: {
      entry: {
        type: "emitSuccessfulDeposit",
      },

      description:
        "Configure the payload for ft_transfer_call,\n\nwhich triggers the NEAR wallet and\n\nbroadcasts the transaction",

      always: {
        target: "Completed",
      },
    },

    "Not Found or Invalid": {
      type: "final",
    },

    Completed: {
      type: "final",
    },

    Aborted: {
      type: "final",
      entry: ["emitFailedDeposit"],
    },
  },
})
