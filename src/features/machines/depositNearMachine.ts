import { assign, fromPromise, setup } from "xstate"
import type { BlockchainEnum } from "../../types/deposit"

export type Context = {
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

type Input = {
  amount: string
  asset: string
}

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
    signAndSendTransactions: fromPromise(
      async ({ input }: { input: Input }): Promise<string> => {
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
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0AdmAIYBOAdFhADZgDEAkgHIAKAqgCoDaADALqJQGbDizoCgkAA9EARgBMAVnIAWAJwaAHAGYFazWr0AaEAE9EaleXnqNANgDsK7T1m7tAXw8mUw3IRIKbCgCLAIoOghxMEoCADd0AGsY30x-IjJyYNDwhDCEgGNiUXFePjLJPxKJJGlERXkHckVNRUNNFU1NWS67E3MEbtUNfTsVBx5xlUVZLx80NPwMoKwQsIiwUlJ0ClRqYoAzHYBbclSRAMzs9bz49CLqsoraqrEa0BkEBqaWtp7O7q9fpyBzKHgObrySyaHhjbSKRRzEDndKBchxTZYA6mdZ0Z5CRZvSSfSzaciyRR2eRUzR2HjUtTAhDyJTkbQOeTwtR2OyKBzaOz6JEopZojGkLE48J42QCF6E8TEizOcmU6nyWn0wVM-TkTQc7T6FoqenyYULC7LcgAI22xAgRVgomlUSIsQSyTOFtRmVt6HtjudUFuhWKbye-EqCvedQQshUGuaihUgtkYx6akUTPkrmaOg1fMsJrpKi83hABHQKHgtRFl1IUZERNqnzwfTMiDwyhGPd7Gk85brVqotEbuGbH0QCaZslkTQhakm1J4rXUGvNVXrWVWOSgY+qSuZ7OaEJXDTnPCN2h1Vg1i8UhtnrjU68H3tFmXFkvW+4nse6VhpjyybjA0jTXh2cY8GSD6LhyEwsmeagbosW4AILWjsOCQL+iotogDiWOQVLqJoOZtIRPIzpmeqOG4FIIjCLIoZaaJ+gGxBOj+8pNnhk5xvRqjTPCTgOD0YkqDOlJ6hyJpuJmHRQshb6blaTDoDgAAEABi6AAK4EBAmk7JpDDxMQ1BULhMafLOuhCQ+fLjOJ8Y6so+qcoY0FqBMMLKfMqlogAwugxx7GA2EQNZh5pg0er6NMmZOLIrgQQMLLyGyBrnvI8acgoZYeEAA */
  id: "deposit-near",
  initial: "idle",
  context: {
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
