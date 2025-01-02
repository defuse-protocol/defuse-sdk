import { assign, emit, fromPromise, setup } from "xstate"
import type { SwappableToken } from "../../types/swap"

export type DepositDescription = {
  type: "depositNear"
  userAddressId: string
  amount: bigint
  asset: SwappableToken
}

export type Context = {
  balance: bigint
  amount: bigint
  asset: SwappableToken
  accountId: string
  tokenAddress: string
  txHash: string | null
  storageDepositRequired: bigint
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
  asset: SwappableToken
  accountId: string
  storageDepositRequired: bigint
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

export const depositNearMachine = setup({
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
        input: { txHash: string; accountId: string; amount: bigint }
      }): Promise<boolean> => {
        throw new Error("not implemented")
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
      console.error(params.error)
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
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0AdmAIYBOAdNlAVgVAMQTpHm0Bu6A1mOShtviJlKWarSgJ26AMbEcWZgG0ADAF0VqxKH64FBLSAAeiAOwAOACzkAbNYBMAVhPWnATguuAzAEYANCABPRDxvC2VyVxMHHzsTT1c7O2VvawBfVP8+TFxCEgoqGjp6MFJSdApUABs5ADNygFteNGzBPJExOkkCDll5JTUNAx0+-SQjUzMHck9PZWjXB0nlM3N-IIQ8B1cbewXvFIszbzMzdMzmgVyyegBhABkAUQBBACUAfQeXl4B5F8Gx4Z6AzGBCWbzkZIOCzWVzKDz2aFrYKeDzkBzKOzxVyRMJmLwmM4gLKXIQUNglLA1ALiRjMHhSbhNYZXMkUqniLo9OR6DT-bQtIFjEHeTx2aw2FLJDELCyeBx2JEbfYmCKuFboiwmbyxHynDJEi45UnkcmkSnUoolMoVao4OqkRrEo1tU3mjlSXo8gZqIYC5jAxAi2I2PEmVzWaEmMKeMyKvCTCEzfYohz7OyTTyEp2tYQAIzKxAgslg8iKfJAgP9QsDars5Es6NscTsrm80TjytV6rhWp1dm86X1BHQKHgY2zLN9AkFoBBsqsJmbXlsHll1jjiTM5E10RbW0sKwH+onxoK4inuirs8Qhzri9Fy4j7k868CwX22zbSW8CS1yxRrhZoaOasma7J0BeIwBgg3jKDCEQxE2JjKFGyiuB2sGJj4PjynC1hmKKQHMsa+boIWxallAkEzuMMH4SqZg9tqRyLJqsZvkqP7kD+iQYp4i7zlCREtCy5AAHLoDgAAEABi6AAK4EBAUnlFJACS3TEJUWAQNRV60UG4KMbMXhhLYXgOIq0LbnK1hRgssw+AsaTHsBok3Og9RVGAOCQHpozXggSR4miWywvKzZzJZHEhEk5BRuqixalqxwWMJJJtE8ublL5ukAn6AW0WGW4xkGDj2M4jgKhxsHgsFtg8UkMZ2IOqRAA */
  id: "deposit-near",

  initial: "signing",

  output: ({ context }): Output => {
    if (context.txHash != null) {
      return {
        tag: "ok",
        value: {
          txHash: context.txHash,
          depositDescription: {
            type: "depositNear",
            userAddressId: context.accountId,
            amount: context.amount,
            asset: context.asset,
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
      asset: input.asset,
      accountId: input.accountId,
      txHash: null,
      error: null,
      tokenAddress: "",
      storageDepositRequired: input.storageDepositRequired,
    }
  },

  states: {
    signing: {
      invoke: {
        id: "deposit-near.signing:invocation[0]",

        input: ({ context }) => {
          return {
            balance: context.balance,
            amount: context.amount,
            accountId: context.accountId,
            asset: context.asset,
            storageDepositRequired: context.storageDepositRequired,
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
                console.log("onError type: setError", event)
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

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("unknown error")
}
