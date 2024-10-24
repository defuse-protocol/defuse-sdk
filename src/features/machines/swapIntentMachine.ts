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
  status: "aborted" | "confirmed" | "not-found-or-invalid" | "network-error"
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
    logError: (_, err: unknown) => {
      console.error(err)
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
    isIntentRelevant: () => {
      // todo: Implement this guard
      console.warn("isIntentRelevant guard is not implemented")
      return true
    },
    isSigned: (_, params: WalletSignatureResult | null) => params != null,
    isTrue: (_, params: boolean) => params,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaAlgOwBcxCA6HCAGzAGIBtABgF1FQMB7WHAnNvFkAB6IAjMIAcJACwBOAGwB2AKxiATJMnDpAZkmyANCACeiLVvkklK+iuk2tixfWmKAvi4OpMuQsQIkAamAATjgAZob4UAAEAAoArgBGFDgAxlEA0mCGsUFwxCk0ELxgZHgAbmwA1iWe2PhEpIEh4ZGxiclpmdkxubD5YAj4FSlo3LwMjBP87JxjfEiCJpIkWvSKcnJi8tKSiirCBsYIO8tiYtqykirnsirXbh7odT6NwWEReNHxSakZWTl5PAFahFPAlIZVGpPbwNPxNd6tb4dP7dXr9QblNgjOYTWjCZgLGZcHjzUBCBBYDQSFSKLQ7WR7OTXbSHRAnEhnC5XG53aQPEC1GG+AJvFqfNo-Tr-HqA4HBIJsIIkDAUUahRUAWxIgvqwvhYq+7V+XQBfSBAwh2JJuKY0w4xN4-HJWC0snoJAU0nokjM1j2jn0RkQYnUJEUDOE9Hk6lU8jEsn5OpefgAyjgoHhIiDiqUKtVtem8ABZOCwNAwKaE+1zJ0mCT0Onyfb0eiyMxx3SshCyENSMQByOSMT0G6J6G60hpjNZ0HgzH5zgZkuwMsV-F22Yk2sUyRRkhRu6qUzCcP7LuyaTmeQN27yJSiOTyMdeCepwtZ+WK5WqgjqoJaxdi1LcswErVhqy3BZnR0aQpEvXcG0UeRZGEQMjgcFQSBPaQ5HoYQVF9HZn2eWESAAIQVNAIBGWBuHFABJZNszBXNIW1YgIGXVdQNtKtN0dKC2S0Eh9mjRQrjva55HsLthB0ZZhEkaN8JUaSe2cYihVICi2Comi6OiRjYWoT8lRVNVNXYvBOOAitePA-jSUWClhDjETZDbbQ8NUaRFNkulFHcxTxGQhRrE018RWaD5DKYsCQCJGtBIQURqRg+Nw2vDQL1kqNhM2Ht1mkpRlAi5MooRBi4vXPiHSc8kZEwmlvUU25dlbaRZN2CQ70agjH3OMrSIAcTAAgDKiIzfCiFMCFGOJYGYuc8yhF9ytG8bWimwgZrmggFoxYZRmtJh4sSyCyRMQKbG5OMxC0c4lPE2TbialtHG2EcxEUlQhuFDaJu2ghdvmxbZ1Yhdx3WsbAeTEH9tgQ6sWO8ZTpqhy6u3V0JAZUxnHUFQ3TuLQXruET3qjL0zh+v7SABra4dm0GTKCBUzJ-P8AKhkaYYZ2F4YOy0UbwG0CQxpLLopZwPXWVTVFvNTJFk2llhkJTI3kRSzGkMQ3HcEA8DYCA4H4JNYQ3THkspDyRNpelGVuc4SaDFKdBE4ddy0O4NA12m-HIKgLYl5z8OEFZNbkxRRDjL3zi7QmJB9VTxJ1jQNCUP2KoNCVkRNGUzQKIOLucpSPW6k97FdNs45d77YK0VzLCUC86UkTOp0zT4i4EyXKXrn0H1Qqwm29LsrlkPtrxscN1m0XX9bN4UAGFeFCHB-0gbv6pEUwwwChvVK9mwxFk+MJFEVyPNpVDaS0TOADk2GBgAxNg4msqJFUm8o0GSCAt+3FcU4J4kJqFsJeVyp9lArDanSe6IYoyuAXtzYUABBBIioiD-1qsHZ0Nh3Q6DjPhcMSkRwqFPl6ESyFdgN12D2W4mcdJ6TQLRPmvgAFWyHLJRSsFhyiFdL5FsQ5M76hit-c2ODi7kkjIFA82hj7yQZCfF2kZFIrBwtYRBclrAJmQWtUi98xooEVJUKIABRVmioOG90jO6fYahXS6BniORQFC7HUNsKsUwzdM70yqvzJmCNrHOWjFIcSBM3TiBbCOLqmg4JnF9AovWLggA */
  context: ({ input }) => {
    return {
      quoterRef: null,
      messageToSign: null,
      signature: null,
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

        onError: "Aborted",

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
          target: "Aborted",
          actions: {
            type: "logError",
            // @ts-expect-error Incorrect `event` type, `error` present in `event` for sure
            params: ({ event }) => event.error,
          },
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
          guard: and(["isIntentRelevant", "isSignatureValid"]),
        },
        {
          target: "Not Found or Invalid",
          reenter: true,
        },
      ],
    },

    "Network Error": {
      type: "final",
      output: {
        status: "network-error",
      },
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

function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}
