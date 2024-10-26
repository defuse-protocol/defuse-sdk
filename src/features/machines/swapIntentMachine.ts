import type { providers } from "near-api-js"
import { assign, fromPromise, log, setup } from "xstate"
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
import type { ChildEvent as BackgroundQuoterEvents } from "./backgroundQuoterMachine"
import {
  type SendNearTransaction,
  publicKeyVerifierMachine,
} from "./publicKeyVerifierMachine"
import type { AggregatedQuote } from "./queryQuoteMachine"

type Context = {
  userAddress: string
  nearClient: providers.Provider
  sendNearTransaction: SendNearTransaction
  lastSeenQuote: AggregatedQuote
  quote: AggregatedQuote
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
  quote: AggregatedQuote
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

type Events = BackgroundQuoterEvents

export const swapIntentMachine = setup({
  types: {
    context: {} as Context,
    input: {} as Input,
    output: {} as Output,
    events: {} as Events,
  },
  actions: {
    setError: assign({
      error: (_, error: NonNullable<Context["error"]>) => error,
    }),
    logError: (_, params: { error: unknown }) => {
      console.error(params.error)
    },
    setLastSeenQuote: assign({
      lastSeenQuote: (_, quote: AggregatedQuote) => quote,
    }),
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
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaAlgOwBcxCBiAVQAUARAQQBUBRAfQEUyB5RgbQAYBdRKAwB7WDgI5heQSAAeiAOwBGAGwA6ABwblKngFYlAZj16FegDQgAnokMBOBWqUAmQ4Y0qThhQp6GAvv6WqJi4hMQEajgQADZgJLwCSCAiYhJSMvIIRhpqPM48SgAses4adipadkWWNgj2uSrORX4mpjxFKiqBwejY+ESEagDKOFB4+FAkEFJgUXgAbsIA1nNi4wCycLBoMIkyqeKS0slZqk4GKkVFhkXabioKtYhXRU5mV9p6LXoBQSAhfrhIajcaTaazeZLVZqdZ4LawHZ7JRJISiI4ZU6ILCGJS5TouQwqOzuewkmrWF5lNRFZzE3R2fIKFSGZw9AF9MKDSKgiZ4KZgABOguEgrUGBiaAIADNRQBbWFjeHbXZgfbJQ7pE6gLJYOk8TQeIlElRKRlKJTPBDXOxqPTVOwVMx6JoaIzswFciJqABqQpw0qskwABBQAK4AIxiOAAxsGANJgKyhwVwYgx+IzPBzfDQtacgbev2CgNB-mhyPRuOJ5MUVOwdNgBC54QxqXHRLqtFpY6ZWxvQz6CoVbTVUqWykIapvKpE2nlJplD0F4GRYulkPhqOxhNJlNpvAZiHZqErfOhQtDdeBzeVnc1-cNw9NlttrWdlEHdFavsIHHOW0rjKDQTG0ZRqitR1HFNe0QKKBxcQcZcL1XX1-RvcstyrXda3rRsSCFEUxQlKVZUFBVPUvNd0LLKAK23as9zrA8M2bRZW3bKRO34L8e0xHVsQAg0hNeACXTsACrQUCS1AUDQSjKewyRZZCgW5NQACERTQCA21gCRywASVXY8c3YmFKNQrThB0vSDLo4zuTYpY3w7fguxSb9eyxBBlDUElql8XQFGcIx8itIwmicQcDFuQlSgUVSvSGazbLQfSQ0ciICOFUVxUlGV5VhFd1NS3T0vs4MssIZyOPfdyeI1Lz+LkQS3X8x1KgUB54OZQwIrNdQPCuc0eG62CkqotCSwwhyTI8zVvIEhAPFk5pTA8ZQCh4R4Bp4XIzA0AoSmZZxmUS-5LPU69aKq+bPyavjtVa+pmjtDxTGMPEmX6yclDG4T5MZZkHXtIpAn+PBhAgOAZCuiJeIxZ7dW8aD5xAvQwLNCk6lcW0eAcXxMZCpRvhKSbUOiOJEZ-HzigNcobRCx1QpJZwrVZdRaR25pOmqM6NAp9TeUmGmlpegCaX+nJuuUMwFBuK07mcNQ3G0EpimcLWJPBy6SqLGjbwYnDH0bMWWqyIo0Y2uTMYcN0nknN1bVxHwEvE+xdd6FDSu08qMqM1dzeRxBMbyOSFcXeTbi0CLQqUO0LV0fJjSHIWDZm27qoIYPf3+vRw4A1k7A0W5OkxiLCltUuWjGuw9EKLXuj1n3vQAYWEOUJTAIgIFznz67tOu7h4UexzKCLSjeUKztKR5iZJdOhgAcWIf04wYXLBX75a9SuIeQNH0mJPtR26lJt6Z7MOlDukv5AiAA */
  context: ({ input }) => {
    return {
      messageToSign: null,
      signature: null,
      error: null,
      intentHash: null,
      lastSeenQuote: input.quote,
      ...input,
    }
  },

  id: "swap-intent",

  initial: "idle",

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

  on: {
    NEW_QUOTE: {
      actions: [
        {
          type: "setLastSeenQuote",
          params: ({ event }) => event.params.quote,
        },
        log(({ context }) => {
          return {
            message: "New quote received",
            quote: context.quote,
            lastSeenQuote: context.lastSeenQuote,
          }
        }),
      ],
    },
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
