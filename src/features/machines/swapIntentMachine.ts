import { secp256k1 } from "@noble/curves/secp256k1"
import type { providers } from "near-api-js"
import { verifyMessage as verifyMessageViem } from "viem"
import { assign, fromPromise, setup } from "xstate"
import { settings } from "../../config/settings"
import {
  submitIntent,
  waitForIntentSettlement,
} from "../../services/intentService"
import type { AggregatedQuote } from "../../services/quoteService"
import type { WalletMessage, WalletSignatureResult } from "../../types"
import type { BaseTokenInfo } from "../../types/base"
import type { Nep413DefuseMessageFor_DefuseIntents } from "../../types/defuse-contracts-types"
import { userAddressToDefuseUserId } from "../../utils/defuse"
import {
  makeInnerSwapMessage,
  makeSwapMessage,
} from "../../utils/messageFactory"
import type { ParentEvents as BackgroundQuoterEvents } from "./backgroundQuoterMachine"
import {
  type SendNearTransaction,
  publicKeyVerifierMachine,
} from "./publicKeyVerifierMachine"

// No-op usage to prevent tree-shaking. sec256k1 is dynamically loaded by viem.
const _noop = secp256k1.getPublicKey || null

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

export type IntentDescription =
  | {
      type: "swap"
      quote: AggregatedQuote
    }
  | {
      type: "withdraw"
      amountWithdrawn: bigint
    }

type Context = {
  userAddress: string
  nearClient: providers.Provider
  sendNearTransaction: SendNearTransaction
  intentOperationParams: IntentOperationParams
  messageToSign: null | {
    walletMessage: WalletMessage
    innerMessage: Nep413DefuseMessageFor_DefuseIntents
  }
  signature: WalletSignatureResult | null
  intentHash: string | null
  error: null | {
    tag: "err"
    value: {
      reason:
        | "ERR_USER_DIDNT_SIGN"
        | "ERR_CANNOT_VERIFY_SIGNATURE"
        | "ERR_SIGNED_DIFFERENT_ACCOUNT"
        | "ERR_CANNOT_VERIFY_PUBLIC_KEY"
        | "ERR_CANNOT_PUBLISH_INTENT"
        | "ERR_QUOTE_EXPIRED_RETURN_IS_LOWER"
      error: Error | null
    }
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
      tag: "ok"
      value: {
        intentHash: string
        intentDescription: IntentDescription
      }
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
      error: (_, error: NonNullable<Context["error"]>["value"]) => ({
        tag: "err" as const,
        value: error,
      }),
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
          signerId: userAddressToDefuseUserId(context.userAddress),
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
    verifySignatureActor: fromPromise(
      ({
        input,
      }: {
        input: { signature: WalletSignatureResult; userAddress: string }
      }) => {
        return verifyWalletSignature(input.signature, input.userAddress)
      }
    ),
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
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaAlgOwBcxCBiAOQFEB1AfQEUBVAeQBUKBtABgF1FQMA9rBwEcAvHxAAPRACYAnAFYAdPIAcigGyKA7It0BGTcYDMAGhABPRAZOzlJxfJNqdmnTs7zOsgCwBffwtUTFxCYgJlHAgAGzASLl4kEEFhUXFJGQRbNWUfTgNfRVk1eU01Ut8LawQTdWVNP05HfU9fY0Dg9Gx8IkJlAGUcKDx8KBIIcTAovAA3AQBraeERgFk4WDQYRMlUkTEJZKzvZRLdV0bfWVkdAwNqxEaDVSKTO18dK7cTTpAQnvC-SGIzGJDAACdwQJwcoMDE0AQAGbQgC2yhWeHWsE22x4uyE+wyR0QWFkmk4ygqmhM1OMBm8dweCF8vnkyicrLKei0JVsv3+YT6kQAahCcIjLGMAAQABQArgAjGI4ADGUoA0mBLLLwXBiCr4pM8NN8PMlrDFcqVZrLKLweKcBCAEpgRE7ZJ7dKHUBZWQmVT09qFbxvLwGHRMgycHT2WRGErucn0-T87qCiLKO3iyV4KCyy2qjVanV6vAGiZTGZm6YYAvWrVZxGO8Eut0GJL8AlezJyMqUv1qO5RpxqD6aSN3XyqckKTjlQfRn5BP5p3oZxs5vPypWFm0l2D6+IQqEwuEI5HgtG1nf121ipvO13uztpA49hCkk5XeSfZzFOMFFUVg2JwnAqJoUYuDog6KEYHipqEa79AAQlCaAQCqaCwKIuZSgAkoCBAVsaVaLMsq6EcoqECOhmHYdKBFCggpoCJhXqJM+KRdm+xIILclKgS4fqKEU+gFJGHwqIojjRtc8gGBUnABMuApIZE1G0VhOF5oxERgpC0KwvCSKouiFFClRaEYVpDGEcxcysQiBwcXiHrcUSPokiU9g5B4+ilAY+juJGJhRqctxKaUajznoCEAhZG62UKCSuS+hLetIiDReyGiskpCkiWS47Adk1w+Y03yiWoSmKHF6b9IluG6aQ7Dtvir4eZltR+MoLKfBoZLSZo8iyCFPWhm8ziTbIxR1Wpmb3puUrAngCJyrqxEmg55qqZRjV5ita26vZ8xsc5PCcZ6PGed1yjfPksEiSyaijSVGgUmJnh1KB1LOHNe2LdKh0EOthqVixO3meugO4cDoMnY57EXW1bkdRlWRYCYvjPApZJhj+bweEyg72NGOgmHocafM0S5dIhAP2hKQPDKtIMbcehlniZl5mfTCUwwdLNHWACNneILkdlxaPvpjzSnGSFTyKyL2OPcJXGLkmjYxBSuFLY1yBMueACBAcCSLtQrtelMsuGyuPkvJBMUxGJV+myXhuPISgwUUyl0-FGbRHEVvdrxhQUpUrIxl7cbOK9NR2JovWyHOfjtErNxqP9FkrWMIfXV1Ci9VGvkU+Gui+OYJW+C9DhQUUhRlSNfsrnz0OM0t25WkW2oyrqB5lmA+edRjKheBULKBbB4blPITJx6csHDToShlNotOtwHKFWXR2n4YRw-o4guiqHU2gr3oHjlC7NT61O8kQU4dyKGobyaNn7fZklESH++Ub328UcHwTDRgqFoCcbxTguC0OUBQ2gfAf36AAYQECiOEYAiAQF-rxJQDh5xOH6iUGMxVb7Uh0A0cMoUp4iWjIgyIABxYgYo1QUAMuCbBN1SRawaJJCedx5JExKkYCmFDybP30L4WhKkoYNQFstIWbMh6o2trxaSd1mhuEUKBUchUgI1HJvYQcdRX5Y3UB4ZSgQgA */
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
      const intentType = context.intentOperationParams.type
      switch (intentType) {
        case "swap":
          return {
            tag: "ok",
            value: {
              intentHash: context.intentHash,
              intentDescription: {
                type: "swap",
                quote: context.intentOperationParams.quote,
              },
            },
          }
        case "withdraw": {
          const { quote, directWithdrawalAmount } =
            context.intentOperationParams

          const totalAmountWithdrawn =
            directWithdrawalAmount + (quote?.totalAmountOut ?? 0n)

          return {
            tag: "ok",
            value: {
              intentHash: context.intentHash,
              intentDescription: {
                type: "withdraw",
                amountWithdrawn: totalAmountWithdrawn,
              },
            },
          }
        }
        default:
          intentType satisfies never
          throw new Error("exhaustive check failed")
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
      always: "Signing",
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

        onDone: {
          target: "Verifying Signature",

          actions: {
            type: "setSignature",
            params: ({ event }) => event.output,
          },
        },

        onError: {
          target: "Generic Error",
          description: "USER_DIDNT_SIGN",

          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => ({
                reason: "ERR_USER_DIDNT_SIGN",
                error: toError(event.error),
              }),
            },
          ],
        },
      },
    },

    "Verifying Signature": {
      invoke: {
        src: "verifySignatureActor",
        input: ({ context }) => {
          assert(context.signature != null, "Signature is not set")
          return {
            signature: context.signature,
            userAddress: context.userAddress,
          }
        },
        onDone: [
          {
            target: "Verifying Public Key Presence",
            guard: {
              type: "isTrue",
              params: ({ event }) => event.output,
            },
          },
          {
            target: "Generic Error",
            description: "SIGNED_DIFFERENT_ACCOUNT",
            actions: {
              type: "setError",
              params: {
                reason: "ERR_SIGNED_DIFFERENT_ACCOUNT",
                error: null,
              },
            },
          },
        ],
        onError: {
          target: "Generic Error",
          description: "ERR_CANNOT_VERIFY_SIGNATURE",

          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => ({
                reason: "ERR_CANNOT_VERIFY_SIGNATURE",
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

            guard: {
              type: "isTrue",
              params: ({ event }) => event.output,
            },
          },
          {
            target: "Generic Error",
            description: "CANNOT_VERIFY_PUBLIC_KEY",

            actions: {
              type: "setError",
              params: {
                reason: "ERR_CANNOT_VERIFY_PUBLIC_KEY",
                error: null,
              },
            },
          },
        ],
        onError: {
          target: "Generic Error",
          description: "CANNOT_VERIFY_PUBLIC_KEY",

          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => ({
                reason: "ERR_CANNOT_VERIFY_PUBLIC_KEY",
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

          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => ({
                reason: "ERR_CANNOT_PUBLISH_INTENT",
                error: toError(event.error),
              }),
            },
          ],
        },

        onDone: {
          target: "Completed",

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

          actions: [
            {
              type: "setError",
              params: {
                reason: "ERR_QUOTE_EXPIRED_RETURN_IS_LOWER",
                error: null,
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

async function verifyWalletSignature(
  signature: WalletSignatureResult,
  userAddress: string
) {
  if (signature == null) return false

  const signatureType = signature.type
  switch (signatureType) {
    case "NEP413":
      return (
        // For NEP-413, it's enough to ensure user didn't switch the account
        signature.signatureData.accountId === userAddress
      )
    case "ERC191": {
      return verifyMessageViem({
        address: userAddress as "0x${string}",
        message: signature.signedData.message,
        signature: signature.signatureData as "0x${string}",
      })
    }
    default:
      signatureType satisfies never
      throw new Error("exhaustive check failed")
  }
}
