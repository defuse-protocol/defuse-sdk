import { assign, fromPromise, setup } from "xstate"
import type { BlockchainEnum } from "../../types/deposit"

export type Context = {
  accountId: string | null
  amount: string | null
  asset: string | null
  error: Error | null
  outcome: unknown | null
}

type Events = {
  type: "INPUT"
  amount: string
  asset: string
  accountId: string
}
// Add other event types here if needed

// biome-ignore lint/complexity/noBannedTypes: It is temporary type
type Input = {}

// biome-ignore lint/complexity/noBannedTypes: It is temporary type
export type Output = {
  // todo: Output is expected to include intent status, intent entity and other relevant data
}

export const depositNearMachine = setup({
  types: {} as {
    context: Context
    events: Events
  },
  actors: {
    signAndSendTransactions: fromPromise(async (): Promise<string> => {
      throw new Error("not implemented")
    }),
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
  id: "deposit-near",
  initial: "idle",
  context: {
    accountId: null,
    amount: null,
    asset: null,
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
          amount: context.amount,
          asset: context.asset,
          accountId: context.accountId,
        }),
        onDone: {
          target: "verifying",
          actions: assign((context, event) => ({
            ...context,
            outcome: null,
          })),
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
      always: [
        {
          target: "broadcasting",
          guard: {
            type: "isDepositValid",
          },
        },
        {
          target: "Not Found or Invalid",
        },
      ],
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
