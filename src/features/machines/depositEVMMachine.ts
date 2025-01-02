import { assign, emit, fromPromise, setup } from "xstate"
import type { SupportedChainName } from "../../types/base"
import type { SwappableToken } from "../../types/swap"

export type DepositDescription = {
  type: "depositEVM"
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
  depositAddress: string
  chainName: SupportedChainName
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
  tokenAddress: string
  depositAddress: string
  chainName: SupportedChainName
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

export const depositEVMMachine = setup({
  types: {} as {
    context: Context
    input: Input
    output: Output
  },
  actors: {
    sendTransaction: fromPromise(
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
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0YAbgLYB02UAdlpVAMQTqVik2HoDWLKG2+RZCtVoI26AMYBDHFiYBtAAwBdRUsSheuWZXUgAHogDMhgBykALIYBshgIwB2BeYUL75gEzmANCACeRp1ITd1t3BU8TAE4beysAXzifHkxcAhJyLCoaejAAJ1z0XNJUABtpADNCsmS+NMFM4ShRSnYpGXllVV1Ndp0kfSNDSNJbJ3cTAFZ7SJc3ax9-BFNhyMMPcwnIh1HzVYSktBT+dMI8rHLfbIYmFjEuUhrUgVJT3PPLkTE27VUu-p7tLoDAhIhMrKQXJEoiYTEMNpMFkZ3PZSNN7LFdlEYvFEiBHscyK93lc8gUiqUKlUHodas8iRdss1WtIfp1lN0joD+sDQRMggoJrZImFPOZ0YillZzCNhVZkeZRvY1pF9niaU90gAjAqSCBSWAyWh0P4aTlMIGIWxWey2UgTCYeWz2qxYwzuCVulFojFQ6KGWIJXGUdAoeD9fF1Dl8LmgYF4cwmCUhFFu0IKOUO5Ho1UR55CbJRrTm7mIBQe6w59UEl5nBm0Qu9C0IKwTdykGyRcyWaLjJxWcs4g49OqkbXoXX6w1QBsxgYIWxrMwt9zWcYeG2GCYe2xmLZbKJbVzKyvD54AOXQOAABAAxdAAV0oECvhSvAEkWpISlgIDPi7HEE7FYdzFT0u3FPxEAmcJUQdZxhShdxVlsE8jhHABhdBiFKMAcEgP8+gA+cTBcCFbC7MIoXRYxDA9dw+ScdEpV9bFUNpdIAEFNUKPDf3+M1CLnTc2ydaDrScWZLH7SCEHtNtrFCKZbFEyx7EDOIgA */
  id: "deposit-evm",

  initial: "signing",

  output: ({ context }): Output => {
    if (context.txHash != null) {
      return {
        tag: "ok",
        value: {
          txHash: context.txHash,
          depositDescription: {
            type: "depositEVM",
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
      tokenAddress: input.tokenAddress,
      depositAddress: input.depositAddress,
      chainName: input.chainName,
      txHash: null,
      error: null,
    }
  },

  states: {
    signing: {
      invoke: {
        id: "deposit-evm.signing:invocation[0]",

        input: ({ context }) => {
          return {
            balance: context.balance,
            amount: context.amount,
            accountId: context.accountId,
            asset: context.asset,
            tokenAddress: context.tokenAddress,
            depositAddress: context.depositAddress,
            chainName: context.chainName,
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
        src: "sendTransaction",
      },
    },

    verifying: {
      invoke: {
        id: "deposit-evm.verifying:invocation[0]",
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
            params: ({ event }) => ({
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
        "Configure the payload for ft_transfer_call,\n\nwhich triggers the EVM wallet and\n\nbroadcasts the transaction",

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
