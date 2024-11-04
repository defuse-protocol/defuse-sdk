import type { providers } from "near-api-js"
import { assign, fromPromise, setup } from "xstate"
import { settings } from "../../config/settings"
import {
  doesSignatureMatchUserAddress,
  submitIntent,
  waitForIntentSettlement,
} from "../../services/intentService"
import type { WalletMessage, WalletSignatureResult } from "../../types"
import type { BaseTokenInfo } from "../../types/base"
import type { DefuseMessageFor_DefuseIntents } from "../../types/defuse-contracts-types"
import {
  makeInnerSwapMessage,
  makeSwapMessage,
} from "../../utils/messageFactory"
import type { ParentEvents as BackgroundQuoterEvents } from "./backgroundQuoterMachine"
import {
  type SendNearTransaction,
  publicKeyVerifierMachine,
} from "./publicKeyVerifierMachine"
import type { AggregatedQuote } from "./queryQuoteMachine"

type IntentOperationParams =
  | {
      type: "swap"
      quote: AggregatedQuote
    }
  | {
      type: "withdraw"
      tokenOut: BaseTokenInfo
      quote: AggregatedQuote | null
      directWithdrawalAmount: bigint
      recipient: string
    }

type Context = {
  userAddress: string
  nearClient: providers.Provider
  sendNearTransaction: SendNearTransaction
  intentOperationParams: IntentOperationParams
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
  intentOperationParams: IntentOperationParams
}

export type Output =
  | NonNullable<Context["error"]>
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
    children: {} as {
      publicKeyVerifierRef: "publicKeyVerifierActor"
    },
  },
  actions: {
    setError: assign({
      error: (_, error: NonNullable<Context["error"]>) => error,
    }),
    logError: (_, params: { error: unknown }) => {
      console.error(params.error)
    },
    proposeQuote: assign({
      intentOperationParams: ({ context }, proposedQuote: AggregatedQuote) => {
        if (context.intentOperationParams.type === "swap") {
          return {
            ...context.intentOperationParams,
            quote: determineNewestValidQuote(
              context.intentOperationParams.quote,
              proposedQuote
            ),
          }
        }

        return context.intentOperationParams
      },
    }),
    assembleSignMessages: assign({
      messageToSign: ({ context }) => {
        assert(
          context.intentOperationParams.type === "swap",
          "Operation must be swap"
        )

        const innerMessage = makeInnerSwapMessage({
          amountsIn: context.intentOperationParams.quote.amountsIn,
          amountsOut: context.intentOperationParams.quote.amountsOut,
          signerId: context.userAddress,
          deadlineTimestamp: Math.min(
            Math.floor(Date.now() / 1000) + settings.swapExpirySec,
            context.intentOperationParams.quote.expirationTime
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
    publicKeyVerifierActor: publicKeyVerifierMachine,
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
      if (context.intentOperationParams.quote != null) {
        // Naively assume that the quote is still relevant if the expiration time is in the future
        return (
          context.intentOperationParams.quote.expirationTime * 1000 > Date.now()
        )
      }

      return true
    },
    isSigned: (_, params: WalletSignatureResult | null) => params != null,
    isTrue: (_, params: boolean) => params,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaAlgOwBcxCBiAOQFEB1AfQEUBVAeQBUKBtABgF1FQMA9rBwEcAvHxAAPRACYAnAFYAdPIAcigGyKA7It0BGTcYDMAGhABPRAZOzlJxfJNqdmnTs7zOsgCwBffwtUTFxCYgJlHAgAGzASLl4kEEFhUXFJGQRbNWUfTgNfRVk1eU01Ut8LawQTdWVNP05HfU9fY0Dg9Gx8IkJlAGUcKDx8KBIIcTAovAA3AQBraeERgFk4WDQYRMlUkTEJZKyjZQNFI19fE19XExN3asRNS9O9Z9dFX05FE06QEJ64X6QxGYwmUxm8yWyhWeHWsE22wMSX4Qn2GSOiCwJgMuXaBlk92cajqziqVieJWUvlkmjKXh8bjsfwBYT6kRBozw4zAACdeQJecoMDE0AQAGaCgC2MOGcI2WzAO2Se3Sh1AWSwtM4ygqmnu900Bm8BgMjwQl3kyicvnkZT0WhKthZ3TZEWUADU+ThxZYxgACAAKAFcAEYxHAAY39AGkwJYg7y4MRI-FJnhpvgoctXb13V7eT6-dyg2GI9G4wnA0nYCmwAgswJI2KDollai0gdMohrg5vmUyq55EVZGaKQhh75daV7jTSo0Si7Qnn+gWiwGQ+Go7H44nk3hU+CM5DFjnl0DImvfRuy9vK3vawf643m2q28jdmi1d2ENiFA05w0RRXB0Y1yRqO0dAaM51E+eQdBxeCl0BdlPW9a8S03csdyrGs6xIPkBSFEUxUlXkZVZFdL3Q4soFLLcK13at91TBs5ibFtxDbHhP07DENSxBQdSE54aSUOkFHNHR5HsHQ1BHElnDtfVkLdfoACEBTQCBm1gUQSwASQvI9M3Y6FKIvZRNIEbTdP0uijPZNj5lfVseHbFIvy7TEEFA1Q6l8TxNE4HRRxMHxzVsRpTnC85rgJRxZB0VSqKsrSdLQPSA0ciICP5QVhVFCVpRhXNLOs2zMvs-0csIZyOLfdyeJVLz+OkQS1AMVRlNuWd4P1SLjU0XVjFtAoQscdQUssq9aJq4yPNVbyBIQNRhtCoo5PcAlOE4B5x1NThcj0NRZE4TbGjcZKgn+MrUNm7KFo-Fq+PVdraj8a01t0RxcUZcwDpC4T5O8NxhyUYdAhuvABAgOBJAs9lePRN7NRMDwAJKICQLA81CStLwPFkQlvicI7ptQ6I4mR78fMKHVKltUK7VHZxZHNOxhppPa-HaYckrUCn3U5MYaeW97-18AwChcBDQL0HQrnNG57DuVwikKYmFD8IXVxom8GJwh86zFtqskCgDdFcDRSjkgwdHNTqrRxDxijeJSAhuxH3QqjKssMi9TdRxBgLyOTFYXeTrgqSLRy684jF2wl9X7XXqMLDCHMDl6UZ-aWVBChQ7HUa52mAyKCitEkvhCpQCmJzQ0+UABhAQpRFMAiAgIOfyUa1a5uXavAUyLiinUckuKdxgOk34vbu90AHFiG9aMKHy3ke58rVnn7jRdpg2QnAdg6x+UCe9FpE7Z6h-wgA */
  context: ({ input }) => {
    return {
      messageToSign: null,
      signature: null,
      error: null,
      intentHash: null,
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
          type: "proposeQuote",
          params: ({ event }) => event.params.quote,
        },
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
        id: "publicKeyVerifierRef",
        src: "publicKeyVerifierActor",
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

          let quoteHashes: string[] = []
          if (context.intentOperationParams.quote) {
            quoteHashes = context.intentOperationParams.quote.quoteHashes
          }

          return {
            quoteHashes,
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

function determineNewestValidQuote(
  originalQuote: AggregatedQuote,
  proposedQuote: AggregatedQuote
): AggregatedQuote {
  if (
    originalQuote.totalAmountOut <= proposedQuote.totalAmountOut &&
    originalQuote.expirationTime <= proposedQuote.expirationTime
  ) {
    return proposedQuote
  }

  return originalQuote
}
