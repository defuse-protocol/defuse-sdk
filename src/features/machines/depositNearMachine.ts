import { assign, emit, fromPromise, setup } from "xstate"
import type { SwappableToken } from "../../types"

export type Context = {
  amount: bigint | null
  asset: SwappableToken | null
  tokenAddress: string | null
  accountId: string | null
  txHash: string | null
  balance: bigint | null
  error:
    | null
    | {
        status: "ERR_SUBMITTING_TRANSACTION"
        error: Error
      }
    | {
        status: "ERR_VERIFYING_TRANSACTION"
        error: Error | null
      }
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
  | NonNullable<Context["error"]>
  | {
      status: "DEPOSIT_COMPLETED"
      txHash: string
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
    setError: assign({
      error: (_, error: NonNullable<Context["error"]>) => error,
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
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0AdmAIYBOAdNlAVgVAMQTpHm0Bu6A1mOShtviJlKWarSgJ26AMbEcWZgG0ADAF0VqxKH64FBLSAAeiAOwAOACzkAbNYBMAVhPWnATguuAzAEYANCABPRDxvC2VyVxMHHzsTT1c7O2VvawBfVP8+TFxCEgoqGjp6MFJSdApUABs5ADNygFteNGzBPJExOkkCDll5JTUNAx0+-SQjUzMHck9PZWjXB0nlM3N-IIQ8B1cbewXvFIszbzMzdMzmgVzhNhKsGoDxRmYeKW4m4auKG9I7h86pXp6DSDMbDPQGYwIbyeOzWGwpZLKOwLCyeBx2NbBfYmCKuFYOZQWEzeWI+U4ZEBZS5CL63e6PEplCrVHB1UiNKk5Gnkb6-cRdHpyIEDNRDFrgsaQ6GxGxmSKuawWawmMKeMyYjaTcjKGb7TwWBz7OyTTxnSkXLltABGZWIEFksHkRRB2nFzAhiG8eLs5EsBNscWR3miGpC3hxrjxUUJxNJdm86QpBHQKHgY05rTIYoEEtAkNRVhMga8tg8qOsocSZnIRPRhx1K0JJzNGc+7UKUGzundksQhx9RZhJcV7k8FcCWK95GDSS9sW8y31rhbFsztJ+9LoXZGHqhyms2y8JIDJmUKuUrlD+3COp8PnRhOsZhhK4+3Jt6DtDqdndBbtGeaek+OJmDGJJHIsRLqhOGz7Nsc5JHYnhFgWDgWK+LRtgAcugOAAAQAGLoAArgQEB4eUeEAJLdMQlRYBA265uMUIwt4vo6he+r7geaIakqNZosqHjRDqXoOGkFKttyADC6D1FUYA4JATE9oBCBJHK5AOFsrhzHGcwOFeSTkCq+KLMSxLHOhUmrm2ACCVrlMpjF-jmaksSYeLTEcMISbE9johqC7sZptgIQ2diJqkQA */
  id: "deposit-near",

  initial: "signing",

  output: ({ context }): Output => {
    if (context.txHash != null) {
      return {
        status: "DEPOSIT_COMPLETED",
        txHash: context.txHash,
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
          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => ({
                status: "ERR_SUBMITTING_TRANSACTION",
                error: toError(event.error),
              }),
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
            params: {
              status: "ERR_VERIFYING_TRANSACTION",
              error: null,
            },
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
