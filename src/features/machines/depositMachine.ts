import { type ActorRefFrom, fromPromise, setup } from "xstate"
import type { depositUIMachine } from "./depositUIMachine"

type Context = {
  depositRef: null | ActorRefFrom<typeof depositUIMachine>
}

// biome-ignore lint/complexity/noBannedTypes: It is temporary type
type Input = {}

// biome-ignore lint/complexity/noBannedTypes: It is temporary type
export type Output = {
  // todo: Output is expected to include intent status, intent entity and other relevant data
}

export const depositMachine = setup({
  types: {
    context: {} as Context,
    input: {} as Input,
    output: {} as Output,
  },
  actors: {
    generateDepositAddress: fromPromise(async (): Promise<string> => {
      throw new Error("not implemented")
    }),
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
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcB02UAdlkVAGpYCGAcmFQE4FbGlQDEE6RYepAbugDWvFBmz5CJMpVr0mUtggHoAxlRxZuAbQAMAXT37Eocbi1ETIAB6IAjAA4AzHgBsAVgCcd9wCZfngDsrq52ACy+ADQgAJ72Ybp4Tp5OYcGeYQ66DnZ2AL550WKYuMysMtR0jGXSHGAMDOhMqAA2GgBmTQC2eMUSNWyyVQostcpEguqaOgZGVmbTlkg2iAC0ri5hYZ66Eb5eaT7RcQjhicmp3oGB7gmZBUVoJZKjg5XyePz1WO0xbOxzZYLCxWWwIfzuPC+JyBXw5XS+Vy6XLQ46IJyuTx4OxOXS6JzuBGuba6TwPEB9UqKCpyapfBg-P5kAF2YxA54g5ZgtIuQnJLa6EKEsIEtEIDFYnF4glEklkwoUp79akUd7VABGjSoEHUsE0zK4PD4E2EoiVVNeNOGeE16G1uv1UHGkw0FiMgNMHO4oMQvl2eG8uIcAXCSP8DjF1yxhIcrhywccGXljwWeBgPAYroN3F4KhEvXN+HT9SzTpUUzdswM8y9S1AYMCnlcSWuiM8bc8DmCYtWBLwIqbgQcEUJvmuDgKCqI6BQ8GWlJwNYknPrax8WK2Oz2B0CR1iazCdkSCKCTec7lx7kC5IXAyt8iX5m9XLXuX7JO3GV37h7ft5ASHfxPGA3wRRvQs71VWkRnKKBH0WH0EDCZtAgxXIuzha4cSifdwQDQIEVJHYh0Jbx3HA1MVSGD56UZNh4JXFZwSvbFoWAkIbiCYkxVAsIAzxQJkLxTs0jSCjnkg6jqgAQXVJocEgBjn1XBB1jcUDg0DQTdyRG4xSCXx3xxLZ3FMv1h3E5VLSg61bXtKg9Xo9ll2Upi7BCfCMg8LtdF3BExQvQyjycRE0lM3FG0si1YKkpgaHQHAAAIADF0AAVyICBEqaRKAEkJioFosAgJS6yYkVIUcDFoTxVwbnc-TYSM1IwlMvxsjCKKXhitUmAAYXQLpWjABSSucp8yrBNi8GcYI0gwsMcUawytmM1qzI6rq0zADNS1KxDBIcFtYUxDsu1cX9kX7ZI6s8Pw-BSJwtuLTNHTwABxHb6hGxTxoQl8EGHOwZscYkghuVDBICyEkTOOxvEPMLr0nIA */
  context: ({ input }: { input: Input }) => {
    return {
      depositRef: null,
    }
  },
  id: "deposit",
  type: "parallel",
  description:
    "Handle initializing a new deposit procedure.\n\nResult \\[Branching\\]:\n\n1. Network base direct deposit (Near, Ethereum, etc.);\n2. Indirect deposit via POA bridge;",
  states: {
    signingViaNear: {
      initial: "signing",
      description:
        "Generating sign message, wait for the proof of sign (tx).\n\nResult:\n\n- Update \\[context\\] with payload for ft_transfer_call;\n- Callback event to user for signing the solver message by wallet;",
      states: {
        signing: {
          invoke: {
            input: {},
            onDone: {
              target: "verifying",
            },
            onError: {
              target: "Aborted",
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
    },

    generating: {
      invoke: {
        input: {},
        onDone: {
          target: "#deposit.generating.Genereted",
        },
        src: "generateDepositAddress",
      },
      description: "Generate deposit address via POA bridge",
      states: {
        Genereted: {
          type: "final",
        },
      },
    },
  },
})
