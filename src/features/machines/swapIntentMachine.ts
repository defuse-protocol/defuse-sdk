import { quoteMachine } from "@defuse-protocol/swap-facade"
import type { SolverQuote } from "@defuse-protocol/swap-facade/dist/interfaces/swap-machine.in.interface"
import type { providers } from "near-api-js"
import {
  type ActorRefFrom,
  type OutputFrom,
  assign,
  fromPromise,
  setup,
} from "xstate"
import { settings } from "../../config/settings"
import {
  doesSignatureMatchUserAddress,
  submitIntent,
  waitForIntentSettlement,
} from "../../services/intentService"
import * as solverRelayClient from "../../services/solverRelayHttpClient"
import type * as types from "../../services/solverRelayHttpClient/types"
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
  error:
    | null
    | {
        status: "ERR_USER_DIDNT_SIGN"
        error: Error
      }
    | {
        status: "ERR_SIGNED_DIFFERENT_ACCOUNT"
      }
    | {
        status: "ERR_CANNOT_VERIFY_PUBLIC_KEY"
        error: Error
      }
    | {
        status: "ERR_CANNOT_ADD_PUBLIC_KEY"
      }
    | {
        status: "ERR_CANNOT_PUBLISH_INTENT"
        error: Error
      }
    | {
        status: "ERR_CANNOT_OBTAIN_INTENT_STATUS"
        error: Error
        txHash: string | null
        intentHash: string
      }
  intentStatus:
    | { status: "LIMB" }
    | { status: "PENDING"; intentHash: string }
    | { status: "SETTLED"; txHash: string; intentHash: string }
    | {
        status: "NOT_FOUND_OR_NOT_VALID"
        txHash: string | null
        intentHash: string | null
      }
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

type Output =
  | {
      status: "ERR_USER_DIDNT_SIGN"
      error: Error
    }
  | {
      status: "ERR_SIGNED_DIFFERENT_ACCOUNT"
    }
  | {
      status: "ERR_CANNOT_VERIFY_PUBLIC_KEY"
      error: Error
    }
  | {
      status: "ERR_CANNOT_ADD_PUBLIC_KEY"
    }
  | {
      status: "ERR_CANNOT_PUBLISH_INTENT"
      error: Error
    }
  | {
      status: "ERR_CANNOT_OBTAIN_INTENT_STATUS"
      error: Error
      txHash: string | null
      intentHash: string
    }
  | {
      status: "SETTLED"
      txHash: string
      intentHash: string
    }
  | {
      status: "NOT_FOUND_OR_NOT_VALID"
      txHash: string | null // txHash may present if the intent was broadcasted, but not settled
      intentHash: string | null // intentHash may not present if the intent was invalidated before broadcasting
    }

export const swapIntentMachine = setup({
  types: {
    context: {} as Context,
    input: {} as Input,
    output: {} as Output,
  },
  actions: {
    setError: assign({
      error: (_, error: NonNullable<Context["error"]>) => error,
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
    setIntentStatus: assign({
      intentStatus: (_, intentStatus: Context["intentStatus"]) => intentStatus,
    }),
    setPendingIntentStatus: assign({
      intentStatus: (_, intentHash: string) => ({
        status: "PENDING" as const,
        intentHash: intentHash,
      }),
    }),
    setNotValidIntentStatus: assign({
      intentStatus: () => ({
        status: "NOT_FOUND_OR_NOT_VALID" as const,
        txHash: null,
        intentHash: null,
      }),
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
      }) => submitIntent(input.signatureData, input.quoteHashes)
    ),
    pollIntentStatus: fromPromise(
      ({
        input,
        signal,
      }: { input: { intentHash: string }; signal: AbortSignal }) =>
        waitForIntentSettlement(signal, input.intentHash)
    ),
  },
  guards: {
    isSettled: (
      _,
      { status }: { status: "SETTLED" } | { status: "NOT_FOUND_OR_NOT_VALID" }
    ) => {
      return status === "SETTLED"
    },
    isSignatureValid: (
      { context },
      signature: WalletSignatureResult | null
    ) => {
      return doesSignatureMatchUserAddress(signature, context.userAddress)
    },
    isIntentRelevant: ({ context }) => {
      // Naively assume that the quote is still relevant if the expiration time is in the future
      return context.quote.expirationTime * 1000 > Date.now()
    },
    isSigned: (_, params: WalletSignatureResult | null) => params != null,
    isTrue: (_, params: boolean) => params,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaAlgOwBcxCA6HCAGzAGIBtABgF1FQMB7WHAnNvFkAB6IAjAGYAHCXoAmesIAsAVmniAnADZxa+QBoQAT0SjVk9dPn1Ri6wHZ689eoC+Tvaky5CxAiQDKOKDx8KGoIXjAyPAA3NgBrCM5AgFk4WDQYBmYkEHZObl5+IQRhdRJhRRL5eVF5cRtRUXUbPUMEdSqym0V2usULRVEXN3RsfCJSf0Dg0PDImPiSRLwU2DSM4SzWDi4ePmyirFFhSQdhaUbVCWNL3QNEMxPpdQ16VRkbdVFpIZB3Ua8JgEgngQmAAE5gthgkgYChoAgAMyhAFtFkCVmswJl+LkdgV9ogsE96CQtJ9yephG9hMIWogqqoSIpVPJVBout0VGIfn9POMfAA1cE4BH6YIAAgACgBXABGFBwAGNxQBpMD6KVguDERU0MJ4CL4eYJEZ87wkIVgkVikFSuUK5VqjWSrWwHVgBBGtiK+G7TLY7K4-J7UBFGokUT0ZnPTQ2FnKWl3BAs+SktSNeQqDTSFQ801jc2W60SmXypWq9Wa7V4XUzA1zOImjwF0hF0Ul+3lp1Vt01j1en3B-0bHHbYOFQlfRntFTiax1GxU26tNk2EiU5lz1n1Kk2PPNgGC4Xt22lh0V52u93UcGQ6Gw+FIsGo3kto9Wk9QO1lx2Vl3V3VPWib1fV4f0mFHPJdgnBAiTeEhpDedpM1UbpVEQukEDjaQSBscQlBUYxrk+fd-n5EgACFITQCAfVgbhbQASUPOtDWAhZX0PSjqNotB6IlZj+SAmJBz9JgAy2KD8VDRBFxIS4WTsdR6BsaQxBkTCxDMMpIwqGozisaQ91cX58y4qi2BouiGK-QTvBvCEoRhOFERRRYzPIiyrL4mzxTswhhJAodxIgwMx2gglYK5eS2VjBp2lUD5RE0qlSnERxWTkFSrBMUizVbY8bVsliJJycLpMERB0tw8xFDw+LjGsTTXlEKRXm6BxY0cPK3wtQqBJKkcwqkkNKoQI5GQaTNMspRNWmEFTShUj46vodLug+HquMlNgKAVJjD3FXwCHhaVYFYhsOI880dr2gb+SOk6CDOwLRLAkLNjKkaYPEHCviacRXgWkwo2aJMShzBD6CjFS3i0BRvhMzjyNu-bioe47TvO28nIfVzn3cg8Ud2tG-MOzHntgV7QLwcDPqDCKZNgyNU0uRQ6isRQZES8RNIIpk6jOLlFzw1QXBMvA2AgOB+GR7xILxUaDlEGw1xnLR51VpdNPQhDNEQrpMzWiR5C28jyCoBXx0ihQSW0bdEPQqkvkw-6SCNswqmeTM8LN81JmBKArcZsbEPdhaxA5kW6uqTDaj+iQbCUBGc3Q02keugqPyK79z27f9e11YOKqKeQ1aUPC8PZnnhDB1pxCpCNa66Iy0OMdPhiJ80vN4-iDv5YulcQdmpErhwc3wmotE0tThCZGllJkRpdLFjOu6z4t+-l4bFZghbFFHxCp3EGoHHZ5rG5PixYa5oXnDXsibpJ+7vEerHB5gzR3ccV451Q8e+h8zjGUWQFgJDHHoJSYyndH6kAAMJsGRLCMARAIAf0iolXC6FzByF+iUPC6hNJ4UeGIWQc5ZCyGgaZdePgADixBhTKgAKKOTBOgpmRJtI5iNnGPClhFyEPBsQ92akvhrWUDIFS4snBAA */
  context: ({ input }) => {
    return {
      quoterRef: null,
      messageToSign: null,
      signature: null,
      error: null,
      intentStatus: { status: "LIMB" },
      ...input,
    }
  },

  id: "swap-intent",

  initial: "idle",

  entry: ["startBackgroundQuoter"],

  output: ({ context }): Output => {
    if (context.error != null) {
      return context.error
    }

    const status = context.intentStatus.status
    switch (status) {
      case "SETTLED":
        return {
          status: "SETTLED",
          txHash: context.intentStatus.txHash,
          intentHash: context.intentStatus.intentHash,
        }
      case "NOT_FOUND_OR_NOT_VALID":
        return {
          status: "NOT_FOUND_OR_NOT_VALID",
          txHash: context.intentStatus.txHash,
          intentHash: context.intentStatus.intentHash,
        }
      case "LIMB":
      case "PENDING":
        throw new Error(
          'Intent status is "LIMB" or "PENDING", but should not be'
        )
      default: {
        status satisfies never
        throw new Error("exhaustive check failed")
      }
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

        src: "signMessage",

        input: ({ context }) => {
          assert(context.messageToSign != null, "Sign message is not set")
          return context.messageToSign.walletMessage
        },

        onDone: [
          {
            target: "Verifying Public Key Presence",
            guard: {
              type: "isSignatureValid",
              params: ({ event }) => event.output,
            },

            actions: {
              type: "setSignature",
              params: ({ event }) => event.output,
            },

            reenter: true,
          },
          {
            target: "Generic Error",
            description: "SIGNED_DIFFERENT_ACCOUNT",
            reenter: true,
            actions: {
              type: "setError",
              params: {
                status: "ERR_SIGNED_DIFFERENT_ACCOUNT",
              },
            },
          },
        ],

        onError: {
          target: "Generic Error",
          description: "USER_DIDNT_SIGN",
          reenter: true,

          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => ({
                status: "ERR_USER_DIDNT_SIGN",
                error: toError(event.error),
              }),
            },
          ],
        },
      },
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
            target: "Generic Error",
            description: "CANNOT_ADD_PUBLIC_KEY",
            reenter: true,
            actions: {
              type: "setError",
              params: {
                status: "ERR_CANNOT_ADD_PUBLIC_KEY",
              },
            },
          },
        ],
        onError: {
          target: "Generic Error",
          description: "CANNOT_VERIFY_PUBLIC_KEY",
          reenter: true,

          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => ({
                status: "ERR_CANNOT_VERIFY_PUBLIC_KEY",
                error: toError(event.error),
              }),
            },
          ],
        },
      },
    },

    "Broadcasting Intent": {
      invoke: {
        src: "broadcastMessage",

        input: ({ context }) => {
          assert(context.signature != null, "Signature is not set")
          assert(context.messageToSign != null, "Sign message is not set")

          return {
            quoteHashes: context.quote.quoteHashes,
            signatureData: context.signature,
          }
        },

        onDone: {
          target: "Polling Intent Status",
          reenter: true,
          actions: {
            type: "setPendingIntentStatus",
            params: ({ event }) => event.output,
          },
        },

        onError: {
          target: "Generic Error",
          description: "CANNOT_PUBLISH_INTENT",
          reenter: true,

          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => ({
                status: "ERR_CANNOT_PUBLISH_INTENT",
                error: toError(event.error),
              }),
            },
          ],
        },
      },
    },

    "Verifying Intent": {
      always: [
        {
          target: "Broadcasting Intent",
          guard: "isIntentRelevant",
        },
        {
          target: "Completed",
          reenter: true,
          actions: "setNotValidIntentStatus",
        },
      ],
    },

    "Polling Intent Status": {
      invoke: {
        src: "pollIntentStatus",

        input: ({ context }) => {
          assert(
            "intentHash" in context.intentStatus &&
              context.intentStatus.intentHash != null,
            "Intent hash is not set"
          )
          return { intentHash: context.intentStatus.intentHash }
        },

        onDone: {
          target: "Completed",
          reenter: true,

          actions: {
            type: "setIntentStatus",
            params: ({ event }) => event.output,
          },
        },

        onError: {
          target: "Generic Error",
          description: "CANNOT_OBTAIN_INTENT_STATUS",
          reenter: true,

          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event, context }) => {
                assert(
                  "intentHash" in context.intentStatus &&
                    context.intentStatus.intentHash != null,
                  "Intent hash is not set"
                )

                return {
                  status: "ERR_CANNOT_OBTAIN_INTENT_STATUS",
                  error: toError(event.error),
                  intentHash: context.intentStatus.intentHash,
                  txHash:
                    "txHash" in context.intentStatus
                      ? context.intentStatus.txHash
                      : null,
                }
              },
            },
          ],
        },
      },
    },

    Completed: {
      type: "final",
    },

    "Generic Error": {
      type: "final",
    },
  },
})

function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("unknown error")
}
