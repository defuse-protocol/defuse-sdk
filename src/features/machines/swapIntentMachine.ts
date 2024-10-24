import { quoteMachine } from "@defuse-protocol/swap-facade"
import type { SolverQuote } from "@defuse-protocol/swap-facade/dist/interfaces/swap-machine.in.interface"
import type { providers } from "near-api-js"
import {
  type ActorRefFrom,
  type OutputFrom,
  and,
  assign,
  fromPromise,
  setup,
} from "xstate"
import { settings } from "../../config/settings"
import { publishIntent } from "../../services/solverRelayHttpClient"
import type {
  SwappableToken,
  WalletMessage,
  WalletSignatureResult,
} from "../../types"
import type { DefuseMessageFor_DefuseIntents } from "../../types/defuse-contracts-types"
import {
  makeInnerSwapMessage,
  makeSwapMessage,
} from "../../utils/messageFactory"
import { prepareSwapSignedData } from "../../utils/prepareBroadcastRequest"
import {
  type SendNearTransaction,
  publicKeyVerifierMachine,
} from "./publicKeyVerifierMachine"
import type { queryQuoteMachine } from "./queryQuoteMachine"

type Context = {
  quoterRef: null | ActorRefFrom<typeof quoteMachine>
  userAddress: string
  nearClient: providers.Provider
  sendNearTransaction: SendNearTransaction
  quote: OutputFrom<typeof queryQuoteMachine>
  tokenIn: SwappableToken
  tokenOut: SwappableToken
  amountIn: bigint
  messageToSign: null | {
    walletMessage: WalletMessage
    innerMessage: DefuseMessageFor_DefuseIntents
  }
  signature: WalletSignatureResult | null
  error: unknown
}

type Input = {
  userAddress: string
  nearClient: providers.Provider
  sendNearTransaction: SendNearTransaction
  quote: OutputFrom<typeof queryQuoteMachine>
  tokenIn: SwappableToken
  tokenOut: SwappableToken
  amountIn: bigint
}

type Output = {
  // todo: Output is expected to include intent status, intent entity and other relevant data
  status: "aborted" | "confirmed" | "not-found-or-invalid" | "generic-error"
}

export const swapIntentMachine = setup({
  types: {
    context: {} as Context,
    input: {} as Input,
    output: {} as Output,
  },
  actions: {
    setError: assign({
      error: (_, params: { error: unknown }) => params.error,
    }),
    logError: (_, params: { error: unknown }) => {
      console.error(params.error)
    },
    assembleSignMessages: assign({
      messageToSign: ({ context }) => {
        const innerMessage = makeInnerSwapMessage({
          amountsIn: context.quote.amountsIn,
          amountsOut: context.quote.amountsOut,
          signerId: context.userAddress,
          deadlineTimestamp: Math.min(
            Math.floor(Date.now() / 1000) + settings.swapExpirySec,
            context.quote.expirationTime
          ),
        })

        return {
          innerMessage,
          walletMessage: makeSwapMessage({
            innerMessage,
            recipient: settings.defuseContractId,
          }),
        }
      },
    }),
    setSignature: assign({
      signature: (_, signature: WalletSignatureResult | null) => signature,
    }),
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
    publicKeyVerifier: publicKeyVerifierMachine,
    signMessage: fromPromise(
      async (_: {
        input: WalletMessage
      }): Promise<WalletSignatureResult | null> => {
        throw new Error("not implemented")
      }
    ),
    broadcastMessage: fromPromise(
      async ({
        input,
      }: {
        input: {
          signatureData: WalletSignatureResult
          quoteHashes: string[]
        }
      }) => {
        return publishIntent({
          signed_data: prepareSwapSignedData(input.signatureData),
          quote_hashes: input.quoteHashes,
        })
      }
    ),
    getIntentStatus: fromPromise(async () => {
      // todo: Implement this actor
      console.warn("getIntentStatus actor is not implemented")
    }),
  },
  guards: {
    isSettled: () => {
      // todo: Implement this guard
      console.warn("isSettled guard is not implemented")
      return true
    },
    isPending: () => {
      throw new Error("not implemented")
    },
    isNotFoundOrInvalid: () => {
      throw new Error("not implemented")
    },
    isSignatureValid: ({ context }) => {
      // todo: Implement this guard
      console.warn("isSignatureValid guard is not implemented")
      return context.signature != null
    },
    isIntentRelevant: ({ context }) => {
      // Naively assume that the quote is still relevant if the expiration time is in the future
      return context.quote.expirationTime * 1000 > Date.now()
    },
    isSigned: (_, params: WalletSignatureResult | null) => params != null,
    isTrue: (_, params: boolean) => params,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaAlgOwBcxCA6HCAGzAGIBtABgF1FQMB7WHAnNvFkAB6IAjMIAcJACwBOAGwB2AKxiATJMnDpAZkmyANCACeiLVvkklK+iuk2tixfWmKAvi4OpMuQsQIkAyjhQePhQ1BC8YGR4AG5sANZRnMEAsnCwaDAMzEgg7JzcvPxCCFoS9FrS8irC9PSyZvJiugbGCLLNUmKOsrWSYvRicm4e6Nj4RKSBwaHhkdFxiSTJeGmwGVnCOawcXDx8uSVYKp31KgrWss7C8vTyrYhXkiRivZplMsKKKq7uIJ7jHxTIIhPBhMAAJwhbAhJAwFDQBAAZjCALbLEFrDZgbL8fJ7IqHRBYRz0EgOaxiKnVJTSZoPBAOZ6VE6WLRqW7CEb-MbeSZ+ABqkJwSMMoQABAAFACuACMKDgAMbigDSYEMUohcGIipoETwUXwiySvImvhIQohIrFYKlcoVyrVGslWtgOrACCNbEViP22VxuXxhQOoBKOhIWnoijkcjE8mkkm+wgZCeeVO0skkJzkKhO3IBfPNlutEpl8qVqvVmu1eF1cwNCwSJq8ZtIxdFpftFad1bdtY9Xp9wf9Wzxu2DxWJNkUJDUWdssmzYnEkhT6heQy0mezi5s+dNQMFwo7trLDsrztd7uokOhsPhiJREPRBdbR6tJ6gdvLjqrLpruqerE3q+rw-pMGOBT7JOCAkqIFhaJo4i1PQmjyMmRiIKowgvJI9AyJmUaZtI+4toeJAAELQmgEA+rA3C2gAkoe9aGsBSx9hAWKZDiEGBuO0FEgg2izjciZZvI1RxvYDLCDozzCJI8gaLm8hbkMvyjGR-KUdRtFoPRErMfyN5QjCcIIsiaLLMQXHpDxAY7FBhKhsSjgqC8CjSHIdzCOcsiKFosmaDOiiyL0uhWIpmZaKRgI6e2NpfsZvh0HxTkEiGggiOIs46HSAUXBoVyyXcWgkLGHTRmpSjKHFhZtseSXiilhB0KO-HOVlJQyB5Pz4dFag9NIsmJhIkm9SolQKEM9VviQADiYAEAxyWHuK-gEIi0qwKxjYcQeOlLStRnrZt22wEBcRDn6TCOXkAkudlpQzjYWZxlSZQJkoq6YQgwi7rOdSOPGgzLlmc3kcdq0tWdW0EDte1egd2nmtDp38ht8M7VdIHDndHUZROQnqSQAWmM46jnNYU2yYDVhRnc0hg4pKiQ0dy0w61BBYxdpl3hZj7Wa+UOcxjvi8wjl2DqBeDgdsD1dTBJJ3BYtymFmK72L9bSKeuymLvYKhNNISFuH8eBsBAcD8CL-KQZlysONICFIcudRoSosnhicA2DJI7JfK87PmuQVAO8Trn-TUEboXJiiiE07JDAy5wSAHxuKDIzSKTcmk8qjwIzGCEeCVHWAyBGAeiKbi53FYOuIFmshdLc04Bd5ZQh41H7NWe3Z-le-al09PXmJmyhfPYW4NCnf3Li7iGSd8ShXJUkjd34ADCvBIjgz6QCP3UiKY5KVIFflqbmdKya8EiiDc4UX+TsV-Hb5oAHJsDzABibDSngCA4oYSwxiGgBUEAj4wSzGmL4ihqi9SqDcW+ygIyLgDnSD4dx87v1IAAQVlDCIgkDOqOyEscKMFUtxhUTsuW42hb7M1nPICefk6SazEJvXSbAaJ0S5oeKB5D+jBUrgMUQW5TZ1H6FwxK4tCCCKjrUGc9dtA2DEPJAKYhSqKQjN5aw2C5KXC4ejJicMLoKOespKQWcqayFQgMOoWi-q5xdtndRbdMHGOIMKZUABRMyEILFHEcBIcKclXjG2NspJxushhkmNhPXMkZJIkXNkAA */
  context: ({ input }) => {
    return {
      quoterRef: null,
      messageToSign: null,
      signature: null,
      error: null,
      ...input,
    }
  },

  id: "swap-intent",

  initial: "idle",

  entry: ["startBackgroundQuoter"],

  output: ({ event }) => {
    return {
      // @ts-expect-error I don't know how to type "done" event
      status: event.output.status,
    }
  },

  states: {
    idle: {
      always: {
        target: "Signing",
        reenter: true,
      },
    },

    Signing: {
      entry: "assembleSignMessages",

      invoke: {
        id: "signMessage",

        onError: {
          target: "Generic Error",
          reenter: true,
          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => event,
            },
          ],
        },

        src: "signMessage",

        input: ({ context }) => {
          assert(context.messageToSign != null, "Sign message is not set")
          return context.messageToSign.walletMessage
        },

        onDone: [
          {
            target: "Verifying Public Key Presence",
            guard: { type: "isSigned", params: ({ event }) => event.output },

            actions: {
              type: "setSignature",
              params: ({ event }) => event.output,
            },

            reenter: true,
          },
          {
            target: "Aborted",
            reenter: true,
          },
        ],
      },

      description:
        "Generating sign message, wait for the proof of sign (signature).\n\nResult:\n\n- Update \\[context\\] with selected best quote;\n- Callback event to user for signing the solver message by wallet;",
    },

    "Verifying Public Key Presence": {
      invoke: {
        src: "publicKeyVerifier",
        input: ({ context }) => {
          assert(context.signature != null, "Signature is not set")

          return {
            nearAccount:
              context.signature.type === "NEP413"
                ? context.signature.signatureData
                : null,
            nearClient: context.nearClient,
            sendNearTransaction: context.sendNearTransaction,
          }
        },
        onDone: [
          {
            target: "Verifying Intent",
            reenter: true,
            guard: {
              type: "isTrue",
              params: ({ event }) => event.output,
            },
          },
          {
            target: "Aborted",
            reenter: true,
          },
        ],
        onError: {
          target: "Generic Error",

          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => event,
            },
          ],

          reenter: true,
        },
      },
    },

    "Broadcasting Intent": {
      invoke: {
        id: "sendMessage",
        input: ({ context }) => {
          assert(context.signature != null, "Signature is not set")
          assert(context.messageToSign != null, "Sign message is not set")

          return {
            quoteHashes: context.quote.quoteHashes,
            signatureData: context.signature,
          }
        },
        src: "broadcastMessage",
        onError: {
          target: "Generic Error",

          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => event,
            },
          ],

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
          guard: and(["isIntentRelevant", "isSignatureValid"]),
        },
        {
          target: "Not Found or Invalid",
          reenter: true,
        },
      ],
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
          target: "Generic Error",
          reenter: true,
          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => event,
            },
          ],
        },
      },
    },

    Confirmed: {
      type: "final",
      description: "The intent is executed successfully.",
      output: {
        status: "confirmed",
      },
    },

    "Not Found or Invalid": {
      type: "final",
      description:
        "Intent is either met deadline or user does not have funds or any other problem. Intent cannot be executed.",
      output: {
        status: "not-found-or-invalid",
      },
    },

    Aborted: {
      type: "final",
      output: {
        status: "aborted",
      },
    },

    "Generic Error": {
      type: "final",
      output: {
        status: "generic-error",
      },
    },
  },
})

function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}
