import { assign, emit, fromPromise, setup } from "xstate"
import { logger } from "../../logger"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../types/base"

export type DepositDescription = {
  type: "depositSolana"
  userAddress: string
  amount: bigint
  token: BaseTokenInfo | UnifiedTokenInfo
}

export type Context = {
  balance: bigint
  amount: bigint
  token: BaseTokenInfo | UnifiedTokenInfo
  userAddress: string
  tokenAddress: string
  txHash: string | null
  depositAddress: string
  error: null | {
    tag: "err"
    value: {
      reason: "ERR_SUBMITTING_TRANSACTION" | "ERR_VERIFYING_TRANSACTION"
      error: Error | null
    }
  }
}

type Input = {
  balance: bigint
  amount: bigint
  token: BaseTokenInfo | UnifiedTokenInfo
  userAddress: string
  tokenAddress: string
  depositAddress: string
}

export type Output =
  | NonNullable<Context["error"]>
  | {
      tag: "ok"
      value: {
        txHash: string
        depositDescription: DepositDescription
      }
    }

export const depositSolanaMachine = setup({
  types: {} as {
    context: Context
    input: Input
    output: Output
  },
  actors: {
    signAndSendTransactions: fromPromise(
      async (_: { input: Input }): Promise<string> => {
        throw new Error("not implemented")
      }
    ),
    validateTransaction: fromPromise(
      async (_: {
        input: { txHash: string; userAddress: string; amount: bigint }
      }): Promise<boolean> => {
        // TODO: implement
        return true
      }
    ),
  },
  actions: {
    setError: assign({
      error: (_, error: NonNullable<Context["error"]>["value"]) => ({
        tag: "err" as const,
        value: error,
      }),
    }),
    logError: (_, params: { error: unknown }) => {
      logger.error(params.error)
    },
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
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0s6ANgIYB2JAdNlGVmVAMQTpliX0Bu6A1uyhmz5CpCtSy16UBF3QBjEjiysA2gAYAuuo2JQg3MrK6QAD0QAmACyXKAZksBOAOwO1ADicBWT86cAaEABPC3MnOydbJzUARgA2ezUnN3NYgF9UgIFMXAJicioaOgZGMAAnUvRSylRSHAAzSoBbSiyhXNECiSLpWQUlVU1tY31+oyRTC0tPShinJ1jPN2joq3NogOCEW2ibWOinSwXbBw83N090zLRs4TyxTjKsOsCpZlZ2WT4W67aRfMoHqUni8GDIyNw+oZtENxiNDMYzAhktNYuZbG5rJ5LAl5hsLJ41HYCaE1ms1JZompbJcQK0cn97o9nq8yhUqjVFA1Ss06bcOgCmSCeuD5IooYNNMMbvDxojkm5KPNLG5Ymd3OYqW48QhzG5bHZQrZzA5vFjUeYabz2v8AEYVEgQBSwJTFGF6aWsBGIaKeZYzeYm6J6w7m7XmAlEtQklaUik7dIZEBkdAoeDjK0MkhSoQy0CIvArByUPYOIO2dHJRyxbXRY6UDy2VWxKPh8PzS0-el3TqSBjZgye2WIPBLYvRUt6itWByosM+OylklohbNk0dkbWxlA5l92EesZ5xDeWKUBxWSwucmxOZoufRYsHRvh9xR1Hrm6bqh29AOp0uqD9qMXoIMsJqUFilhqJ4BzzJSDgOHOhLQRi3jyuiThou+vzdpQABy6A4AABAAYugACuZAQIRlSEQAkuCJBEFgECAbmExIuY5j1kk+xolSWLasq0xeBhKSquGtaeNSiYZjhADC6CNDUYA4JArGDoeIEloqahqIGM6HKWYYXsWunhs4aixJB5aWFhXb8gAgjalSqSxe45hp7HhgqlnnOitYLOSCFBIgjg2NBLYxNi8SWQmqRAA */
  id: "deposit-solana",

  initial: "signing",

  output: ({ context }): Output => {
    if (context.txHash != null) {
      return {
        tag: "ok",
        value: {
          txHash: context.txHash,
          depositDescription: {
            type: "depositSolana",
            userAddress: context.userAddress,
            amount: context.amount,
            token: context.token,
          },
        },
      }
    }

    if (context.error != null) {
      return context.error
    }

    throw new Error("Unexpected output")
  },

  context: ({ input }) => {
    return {
      balance: input.balance,
      amount: input.amount,
      token: input.token,
      userAddress: input.userAddress,
      tokenAddress: input.tokenAddress,
      depositAddress: input.depositAddress,
      txHash: null,
      error: null,
    }
  },

  states: {
    signing: {
      invoke: {
        id: "deposit-solana.signing:invocation[0]",

        input: ({ context }) => {
          return {
            balance: context.balance,
            amount: context.amount,
            userAddress: context.userAddress,
            token: context.token,
            tokenAddress: context.tokenAddress,
            depositAddress: context.depositAddress,
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
          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => {
                return {
                  reason: "ERR_SUBMITTING_TRANSACTION",
                  error: toError(event.error),
                }
              },
            },
          ],
        },
        src: "signAndSendTransactions",
      },
    },

    verifying: {
      invoke: {
        id: "deposit-solana.verifying:invocation[0]",
        input: ({ context }) => ({
          txHash: context.txHash || "",
          userAddress: context.userAddress || "",
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
          actions: {
            type: "setError",
            params: () => ({
              reason: "ERR_VERIFYING_TRANSACTION",
              error: null,
            }),
          },
        },
        src: "validateTransaction",
      },
    },

    broadcasting: {
      entry: {
        type: "emitSuccessfulDeposit",
      },

      description:
        "Configure the payload for ft_transfer_call,\n\nwhich triggers the Solana wallet and\n\nbroadcasts the transaction",

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

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("unknown error")
}
