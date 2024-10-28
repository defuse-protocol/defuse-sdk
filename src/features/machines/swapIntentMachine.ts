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
  intentHash: string | null
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
        error: Error | null
      }
    | {
        status: "ERR_CANNOT_PUBLISH_INTENT"
        error: Error
      }
    | {
        status: "ERR_QUOTE_EXPIRED_RETURN_IS_LOWER"
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
      error: Error | null
    }
  | {
      status: "ERR_CANNOT_PUBLISH_INTENT"
      error: Error
    }
  | {
      status: "ERR_QUOTE_EXPIRED_RETURN_IS_LOWER"
    }
  | {
      status: "INTENT_PUBLISHED"
      intentHash: string
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
    setIntentHash: assign({
      intentHash: (_, intentHash: string) => intentHash,
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
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaAlgOwBcxCA6HCAGzAGIBtABgF1FQMB7WHAnNvFkAB6IAjAGYAHCXoAmesIAsAVmniAnADZxa+QBoQAT0SjVk9dPn1Ri6wHZ689eoC+Tvaky5CxAiQDKOKDx8KGoIXjAyPAA3NgBrCM5AgFk4WDQYBmYkEHZObl5+IQRhdRJhRRL5eVF5cRtRUXUbPUMEdSqym0V2usULRVEXN3RsfCJSf0Dg0PDImPiSRLwU2DSM4SzWDi4ePmyirFFhSQdhaUbVCWNL3QNEMxPpdQ16VRkbdVFpIZB3Ua8JgEgngQmAAE5gthgkgYChoAgAMyhAFtFkCVmswJl+LkdgV9ogsE96CQtJ9yephG9hMIWogqqoSIpVPJVBout0VGIfn9POMfAA1cE4BH6YIAAgACgBXABGFBwAGNxQBpMD6KVguDERU0MJ4CL4eYJEZ87wkIVgkVikFSuUK5VqjWSrWwHVgBBGtiK+G7TLY7K4-J7UBFGokUT0ZnPTQ2FnKWl3BAs+SktSNeQqDTSFQ801jc2W60SmXypWq9Wa7V4XUzA1zOImjwF0hF0Ul+3lp1Vt01j1en3B-0bHHbYOFQlfRntFTiax1GxU26tNk2EiU5lz1n1Kk2PPNgGC4Xt22lh0V52u93UcGQ6Gw+FIsGo3kto9Wk9QO1lx2Vl3V3VPWib1fV4f0mFHPJdgnBAiTeEhpDedpM1UbpVEQukEDjaQSBscQlBUYxrk+fd-n5EgACFITQCAfVgbhbQASUPG8IShGE4URFFFnzQ9KOo2i0HoiVmP5ICYkHP0mADLYoPxUNCS5Eg2Q0OoGnaVQPlETCaQ0UlHFZOR6HqTdSLNVtjxtL9RO8OgIMDMdoIJBBxFKGxzEUPCmjOeh6CaHThHoSQunEWQlA+aQPj3Vxfl48i2ys8UbMIOgRwcuSQ0EIxzCZVzPKsY53m0pNArsBD8LeD4WVQlkzLffi2BouiGOslj9UNYCFlfPiqMawThKYw9xJAodpPs2S8UyopF2U4x5DsdRjOkMQZB0xocJWioajOKxIpcGK8DYCA4H4br+UgyaYMOGw1xnLR5xupcdPQhDNEi8QGnscpapis7zXIKgLvHZyFBJbRt0Q9CqS+TCvlKTM-PMBwWXeuq+MmYEoCBpyFIQRCSHkQKxDUxcuhsapMNqHCGjqJQFBzRDzDR+LLI7H8Lx7d1sfkrKEHm9dwrqOc1Dw4RmiTcQqQjMWukitC5uZ81eqaoSWqSw9uamxBFEkYzabMFRqlqcQdOW4QmRpRaZEaSNmUViyP0S5KCE1mDAsUKR3MuRCPqqdQdZ0uRGV93y40UOQc2cX64vNABhNhkVhMAiAgV3nNQpljJZcRfNeAiTZK5RU2WuWnhCuNBmjg9yIAcWIYVlQAUTYsE09xol2kzudfO+6RmXF1pyhykvZaaHWK-2pwgA */
  context: ({ input }) => {
    return {
      quoterRef: null,
      messageToSign: null,
      signature: null,
      error: null,
      intentHash: null,
      ...input,
    }
  },

  id: "swap-intent",

  initial: "idle",

  entry: ["startBackgroundQuoter"],

  output: ({ context }): Output => {
    if (context.intentHash != null) {
      return {
        status: "INTENT_PUBLISHED",
        intentHash: context.intentHash,
      }
    }

    if (context.error != null) {
      return context.error
    }

    throw new Error("Unexpected output")
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
            description: "CANNOT_VERIFY_PUBLIC_KEY",
            reenter: true,
            actions: {
              type: "setError",
              params: {
                status: "ERR_CANNOT_VERIFY_PUBLIC_KEY",
                error: null,
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

        onDone: {
          target: "Completed",
          reenter: true,
          actions: {
            type: "setIntentHash",
            params: ({ event }) => event.output,
          },
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
          description: "QUOTE_EXPIRED_RETURN_IS_LOWER",
          reenter: true,
          actions: [
            {
              type: "setError",
              params: {
                status: "ERR_QUOTE_EXPIRED_RETURN_IS_LOWER",
              },
            },
          ],
        },
      ],
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
