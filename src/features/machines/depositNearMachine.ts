import { assign, emit, fromPromise, setup } from "xstate"

export type Context = {
  amount: string | null
  asset: string | null
  accountId: string | null
  txHash: string | null
  balance: bigint | null
  error: string | undefined
  outcome: unknown | null
}

type Events = {
  type: "INPUT"
  amount: string
  asset: string
  accountId: string
  balance: bigint
}

type Input = {
  amount: string
  asset: string
  balance: bigint
  accountId: string
}

export const depositNearMachine = setup({
  types: {} as {
    context: Context
    events: Events
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
        input: { txHash: string; accountId: string; amount: string }
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
  initial: "idle",
  context: {
    amount: null,
    balance: null,
    asset: null,
    accountId: null,
    txHash: null,
    error: undefined,
    outcome: null,
  },
  states: {
    idle: {
      on: {
        INPUT: {
          target: "signing",
          actions: assign({
            balance: ({ event }) => event.balance,
            amount: ({ event }) => event.amount,
            asset: ({ event }) => event.asset,
            accountId: ({ event }) => event.accountId,
          }),
        },
      },
    },

    signing: {
      invoke: {
        id: "deposit-near.signing:invocation[0]",
        input: ({ context }) => ({
          amount: context.amount || "",
          asset: context.asset || "",
          balance: context.balance || 0n,
          accountId: context.accountId || "",
        }),
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
          amount: context.amount || "",
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

    Aborted: {
      type: "final",
      actions: ["emitFailedDeposit"],
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
  },
})
