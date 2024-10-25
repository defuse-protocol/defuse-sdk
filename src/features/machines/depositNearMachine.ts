import { assign, fromPromise, setup } from "xstate"
import type { BlockchainEnum } from "../../types/deposit"

export type Context = {
  amount: string | null
  asset: string | null
  accountId: string | null
  txHash: string | null
  error: Error | null
  outcome: unknown | null
}

type Events = {
  type: "INPUT"
  amount: string
  asset: string
  accountId: string
}

type Input = {
  amount: string
  asset: string
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
    broadcastMessage: fromPromise(async (): Promise<string> => {
      throw new Error("not implemented")
    }),
  },
  actions: {
    emitSuccessfulDeposit: () => {
      throw new Error("not implemented")
    },
  },
  guards: {
    isDepositValid: () => {
      throw new Error("not implemented")
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0AdmAIYBOAdFhADZgDEAkgHIAKAqgCoDaADALqJQGbDizoCgkAA9EAVgDss8gGZ5AFgAcsjQCZ5ANgCcPAIyGANCACeiPDrWHya+TsMm1PfRv3LD6gL7+lijCuIQkFNhQBFgEUHQQ4mCUBABu6ADWySGYYURk5FExcQix6QDGxKLivHy1kqHVEkjSiPo6POSu3g728sbKapY2CDpKOh0aJhoaavam8gaBwWi5+PmRWNGx8WCkpOgUqNRVAGaHALbkOSLhBUU7pWnolU219S2NYs2gMgjKRnIAw0hg0Bjcnn0w0QYy6k2ms3mJkWyxANzyEXIqT2WFOVh2CSSKXSWWuq1uGyxOLxjzKLyq33e-Aaa2+kj+Jh49nIPl0hgBhjU+k00NG3h5GkGRimslMhlkqPR60x2NIuPxcToewORxOOHOpCuSruFFV6tpz1ejP4HyErPE7MQBn0XUGsjGWh4c2UGlFOnFXkGHXd02R+gVQTR5IxBQARgdiBBKrBRJrEkRiZlstHlXGE0niCmLRUGTUbczPvafq0EO4FED+fLBlpZGZRbLOuovPpOVyeMoAYFIwR0Ch4C1jRsWSI2S0-soePInDxDMLtPojP0htZbAOXX5XDofK5lCYN2pFTmTZQaGBp7hZ79EMpZEoPKu1OvN4LRXYfTy1F8IVwzUTkTAjFZGmvB44nvJpHQQTQdHIRZlBPc9BQBX8TDMchwI6Mw9E5SUHEvKDKTNGlYMrGcHTnRBJU6bx5WlV9BX7UUzzULohRBNR+JfMCL0jSdMQAQVjQ4cEgODHxrOYXRcKYz1ML0N1kP13BQ-lZn7eQBXsZQyLWa943QRNk1TKBZLop9azmTpPH7IxDH5AEdD9dQUO0LR+LcT8pmMilMSYdAcAAAgAMXQABXAgIHCw5woYNJiGoKgbOrP4DE6QZFklDQvQUVRRW9cgQ1kUE-FXHhJXkIKYwoABhdALmOMBpIgTKEPcWY8JBVxFDGBdw1FcNlHIJyJjGZx5RmId-CAA */
  id: "deposit-near",
  initial: "idle",
  context: {
    amount: null,
    asset: null,
    accountId: null,
    txHash: null,
    error: null,
    outcome: null,
  },
  states: {
    idle: {
      on: {
        INPUT: {
          target: "signing",
          actions: assign({
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
          actions: assign((context, event) => ({
            ...context,
            error: null,
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
    },
    broadcasting: {
      invoke: {
        id: "deposit-near.broadcasting:invocation[0]",
        input: {},
        onDone: {
          target: "Completed",
          actions: {
            type: "emitSuccessfulDeposit",
          },
        },
        src: "broadcastMessage",
      },
      description:
        "Configure the payload for ft_transfer_call,\n\nwhich triggers the NEAR wallet and\n\nbroadcasts the transaction",
    },
    "Not Found or Invalid": {
      type: "final",
    },
    Completed: {
      type: "final",
    },
  },
})
