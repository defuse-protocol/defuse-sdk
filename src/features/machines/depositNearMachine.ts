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
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcC0AdmAIYBOAdFhADZgDEAkgHIAKAqgCoDaADALqJQGbDizoCgkAA9EAVgDss8gGZ5AFgAcsjQCZ5ANgCcPAIyGANCACeiPDrWHya+TsMm1PfRv3LD6gL7+lijCuIQkFNhQBFgEUHQQ4mCUBABu6ADWySGYYURk5FExcQix6QDGxKLivHy1kqHVEkjSiPo6SvpePLLGvj6yljYIssrkhoZaGsoahqPTsrKBwWi5+PmRWNGx8WCkpOgUqNRVAGaHALbkOSLhBUU7pWnolU219S2NYs2gMgjKRnGPF8Jn0Lg0Wh0JkG1jkYwmUxmcxmykWyxANzyEXIqT2WFOVh2dA+QjW30kf0MyjU5B0qnsCgBphMyiGiChGlpVO8zjUdJ6Jnk6Mx62xuNI+MJcWJJgEnzJ4gpiEMan05BMeg08m1PB0uvkGjZ-xMJi5EJMPEMOm8GlVSyCGNWtw25AARgdiBBKrBRNLEkQUukstcnViCu70J7vb6oE8KlVvu9+A0FT9WggNdTyDw1KjlMoWRpQdSjSCVHMdD4LaC1KN9IEHQR0Ch4C0RXdSCmROSWn9lFCgSCwdbIdCjXh82q-K5QRrawD3MLQ6KClRaF3cD3fogZqaIR4jMoc6Y6fJx-ZTdpVYp9KYAVal40O4UtsUoBumkqEJodORtf2qS6Bxc30ccTUcaE9TMPQLWmBxHzWZ9xUlHYPy3dMjAg-tZghAttQNI0oTVHMZgZBxencDQEOdbEAEFXUOHBIDQxVe0QPk1XBE1bwtVV9BhYYoRpeRuQ8VR73sZRqLDCgIyjYgfVQ+Vu1Y7cMzMNULQmHQoRNKDWVhDMHC5GZZFvHgcNw6SVwoJh0BwAACAAxdAAFcCAgBzDgchg0mIagqBYtNKRMTkuiMRYDDBES1CNNQTXIdpQo6K0or0IUHXbF0AGF0AuY4wCYiAgq-DVb1pGYDFCsxtHkEwjVkTRyEWRqixE0Z1DUBt-CAA */
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
