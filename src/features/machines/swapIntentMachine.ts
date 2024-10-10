import { quoteMachine } from "@defuse-protocol/swap-facade"
import type { SolverQuote } from "@defuse-protocol/swap-facade/dist/interfaces/swap-machine.in.interface"
import { type ActorRefFrom, assign, fromPromise, setup } from "xstate"

type Context = {
  quoterRef: null | ActorRefFrom<typeof quoteMachine>
}

// biome-ignore lint/complexity/noBannedTypes: It is temporary type
type Input = {}

// biome-ignore lint/complexity/noBannedTypes: It is temporary type
export type Output = {
  // todo: Output is expected to include intent status, intent entity and other relevant data
}

export const swapIntentMachine = setup({
  types: {
    context: {} as Context,
    input: {} as Input,
    output: {} as Output,
  },
  actions: {
    setError: () => {
      throw new Error("not implemented")
    },
    startBackgroundQuoter: assign({
      // @ts-expect-error For some reason `spawn` creates object which type mismatch
      quoterRef: ({ spawn }) =>
        // @ts-expect-error
        spawn(
          quoteMachine.provide({
            actors: {
              fetchQuotes: fromPromise(async (): Promise<SolverQuote[]> => []),
            },
          }),
          { id: "quoter", input: {} }
        ),
    }),
  },
  actors: {
    signMessage: fromPromise(async () => {
      throw new Error("not implemented")
    }),
    broadcastMessage: fromPromise(async () => {
      throw new Error("not implemented")
    }),
    getIntentStatus: fromPromise(async () => {
      throw new Error("not implemented")
    }),
  },
  guards: {
    isSettled: () => {
      throw new Error("not implemented")
    },
    isPending: () => {
      throw new Error("not implemented")
    },
    isNotFoundOrInvalid: () => {
      throw new Error("not implemented")
    },
    isIntentRelevant: () => {
      throw new Error("not implemented")
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaAlgOwBcxCA6AZRyj3ygGIIB7PME-ANwYGsXZK8BZOLDQwA2gAYAuolAYGvAjiYyQAD0QBOAKwktAZi0BGLQDYNGgOxG9GgBwAaEAE9NewyQt6LFgExaLhl7GGgC+IY6omLiExATkfDS0YABOyQzJJBgANmgEAGbpALYkvFSCsMJiUipyCkp4KuoIWHri4iTiGoa2JgAsGno+Pt5+ji4ItoYmJLb9vb2G4iZL2oZhEejY+ESkAEJpaBAAxmiwinhQAAQAkjGE9Ews7Fw8xBDllWAS0kggtTiKZS-JoDEg+QwWXpaXrDXy2TxaMaIQLzEiGXqQwxDTwmWzadYgSJbO5xfYMQ4nM40G4kpKpdKZHL5IolN4fERfaq-f6AhrAxBYCG2MEmEw2VrdHxdXpIhCBbQi9HdCyiiziHwEonRHZxABqKRweSc1NuOto3xq8gB9UamnclhsFg0-RMWlMWh8ssWng6+nBJj8PlxoXChM22tiJH1yUNxouNLNokMP1kVt5toQ-R8YK04gWvQDUJWXqhwu8WZ8NhMFjxmvD20jAHEwARzldTbFLmQCLkAK6wB7MVh4DjcEr1kkkZutk0krs9gj9hDPE6874W7lpm38hAGMHOnzw2y2PR4jHQr0B7M+Nq5p3iY-ojWhrUN0jTtsJzvdvsDxhD54x1fScP1nHV51-ZcRwYVd6nXZNLTqIFQCaPRcRIV09BsaEYWWIY9EvIYwVvcR70fGE6yiN84lA+MO0ICDFwHFI0gybJcgKZJimAnUpxbT96IIRilxXXI4KkDdUyQvkUIFBVXQ0YZbCDWE0JlZxkX0XoSDmAJSPRLw7DCUM8AYCA4BUHjYkQ61kLUAU9F6YVOm6PoBmxXxEQ0hAtFmEgDBsSxOk6bxKOJXiKCoGgbPTHcsFRTovFPcFvB6ExDFlAJhVzMV+g9BZDAhMKI1IABhJg8hwLjIBi7dZLlLDdGwtxhkGKUHG81zhUKiFRX0KZ9D0YrqJIAA5BghIAMQYXs8AgS50hpNg0CyHAIFquymhhbTJjdXws0sCEvVsXz-MLGwT1mUitGGycAEEACN0iIdbN2kjMsEPPQwUWRyzAhKYsOOjR2mGNzK3ELCrBMW7eLJClTgEkkNpk+zmicr10Q0GZxEKtCujaJzYcjaNYzA6y3ts1GmkKnROlMEH0vMDF1S9Nps3RWxxC0AZAeMIaXwnXjRpbFB0k4S4AFF6WSFGPsWUGsV6NTXVdB8vPGboQbBFUs1aKHTGJ99+PJhifyYuWd0hHScNw3GubaDrNYWbH+mPLx1TsAWwiAA */
  context: ({ input }: { input: Input }) => {
    return {
      quoterRef: null,
    }
  },

  id: "swap-intent",

  initial: "Signing",

  entry: ["startBackgroundQuoter"],

  output: () => ({}),

  states: {
    Signing: {
      invoke: {
        id: "signMessage",

        onError: {
          target: "Aborted",
          actions: "setError",
        },

        src: "signMessage",
        onDone: "Verifying Intent",
      },
      description:
        "Generating sign message, wait for the proof of sign (signature).\n\nResult:\n\n- Update \\[context\\] with selected best quote;\n- Callback event to user for signing the solver message by wallet;",
    },

    Confirmed: {
      type: "final",

      description: "The intent is executed successfully.",
    },

    "Not Found or Invalid": {
      description:
        "Intent is either met deadline or user does not have funds or any other problem. Intent cannot be executed.",
      type: "final",
    },

    Aborted: {
      type: "final",
    },

    "Broadcasting Intent": {
      invoke: {
        id: "sendMessage",
        input: {
          message:
            "I received signature from user and ready to sign my part (left+right side of agreement)",
        },
        src: "broadcastMessage",
        onError: {
          target: "Network Error",

          actions: "setError",

          reenter: true,
        },
        onDone: {
          target: "Getting Intent Status",
          reenter: true,
        },
      },
      description:
        "Send user proof of sign (signature) to solver bus \\[relay responsibility\\].\n\nResult:\n\n- Update \\[context\\] with proof of broadcasting from solver;",
    },

    "Verifying Intent": {
      always: [
        {
          target: "Broadcasting Intent",
          guard: "isIntentRelevant",
        },
        {
          target: "Not Found or Invalid",
          reenter: true,
        },
      ],
    },

    "Network Error": {
      type: "final",
    },

    "Getting Intent Status": {
      invoke: {
        src: "getIntentStatus",

        onDone: [
          {
            target: "Confirmed",
            guard: "isSettled",
            reenter: true,
          },
          {
            target: "Not Found or Invalid",
            guard: "isNotFoundOrInvalid",
            reenter: true,
          },
        ],

        onError: {
          target: "Network Error",
          reenter: true,
        },
      },
    },
  },
})
