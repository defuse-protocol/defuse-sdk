import { secp256k1 } from "@noble/curves/secp256k1"
import { base58 } from "@scure/base"
import type { providers } from "near-api-js"
import { sign } from "tweetnacl"
import { verifyMessage as verifyMessageViem } from "viem"
import { assign, fromPromise, setup } from "xstate"
import { settings } from "../../config/settings"
import { logger } from "../../logger"
import {
  publishIntent,
  waitForIntentSettlement,
} from "../../services/intentService"
import type { AggregatedQuote } from "../../services/quoteService"
import type { BaseTokenInfo, TokenValue } from "../../types/base"
import type { Nep413DefuseMessageFor_DefuseIntents } from "../../types/defuse-contracts-types"
import type { ChainType } from "../../types/deposit"
import type { WalletMessage, WalletSignatureResult } from "../../types/swap"
import { assert } from "../../utils/assert"
import type { DefuseUserId } from "../../utils/defuse"
import {
  makeInnerSwapMessage,
  makeSwapMessage,
} from "../../utils/messageFactory"
import {
  accountSlippageExactIn,
  addAmounts,
  compareAmounts,
  computeTotalDeltaDifferentDecimals,
  negateTokenValue,
  subtractAmounts,
} from "../../utils/tokenUtils"
import {
  type WalletErrorCode,
  extractWalletErrorCode,
} from "../../utils/walletErrorExtractor"
import type { ParentEvents as BackgroundQuoterEvents } from "./backgroundQuoterMachine"
import {
  type ErrorCodes as PublicKeyVerifierErrorCodes,
  type SendNearTransaction,
  publicKeyVerifierMachine,
} from "./publicKeyVerifierMachine"

// No-op usage to prevent tree-shaking. sec256k1 is dynamically loaded by viem.
const _noop = secp256k1.getPublicKey || null

export type NEP141StorageRequirement =
  | {
      type: "swap_needed"
      requiredStorageNEAR: bigint
      quote: AggregatedQuote
    }
  | {
      type: "no_swap_needed"
      requiredStorageNEAR: bigint
      quote: null
    }

type IntentOperationParams =
  | {
      type: "swap"
      tokensIn: BaseTokenInfo[]
      tokenOut: BaseTokenInfo
      quote: AggregatedQuote
    }
  | {
      type: "withdraw"
      tokenOut: BaseTokenInfo
      quote: AggregatedQuote | null
      nep141Storage: NEP141StorageRequirement | null
      directWithdrawalAmount: TokenValue
      recipient: string
      destinationMemo: string | null
    }

export type IntentDescription =
  | {
      type: "swap"
      totalAmountIn: TokenValue
      totalAmountOut: TokenValue
      quote: AggregatedQuote
    }
  | {
      type: "withdraw"
      amountWithdrawn: TokenValue
    }

type Context = {
  userAddress: string
  userChainType: ChainType
  defuseUserId: DefuseUserId
  referral?: string
  slippageBasisPoints: number
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
    value:
      | {
          reason:
            | "ERR_USER_DIDNT_SIGN"
            | "ERR_CANNOT_VERIFY_SIGNATURE"
            | "ERR_SIGNED_DIFFERENT_ACCOUNT"
            | "ERR_PUBKEY_EXCEPTION"
            | "ERR_CANNOT_PUBLISH_INTENT"
            | "ERR_QUOTE_EXPIRED_RETURN_IS_LOWER"
            | WalletErrorCode
            | PublicKeyVerifierErrorCodes
          error: Error | null
        }
      | {
          reason: "ERR_CANNOT_PUBLISH_INTENT"
          server_reason: string
        }
  }
}

type Input = {
  userAddress: string
  userChainType: ChainType
  defuseUserId: DefuseUserId
  referral?: string
  slippageBasisPoints: number
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
    // todo: this bloats size of types, typescript can't produce type definitions
    // children: {} as { publicKeyVerifierRef: "publicKeyVerifierActor" },
  },
  actions: {
    setError: assign({
      error: (_, error: NonNullable<Context["error"]>["value"]) => ({
        tag: "err" as const,
        value: error,
      }),
    }),
    logError: (_, params: { error: unknown }) => {
      logger.error(params.error)
    },
    proposeQuote: assign({
      intentOperationParams: ({ context }, proposedQuote: AggregatedQuote) => {
        if (context.intentOperationParams.type === "swap") {
          return {
            ...context.intentOperationParams,
            quote: determineNewestValidQuote(
              context.intentOperationParams.tokenOut,
              context.intentOperationParams.quote,
              proposedQuote
            ),
          }
        }

        // Quote needs to be updated for withdraw only in case of crosschain withdrawal
        if (
          context.intentOperationParams.type === "withdraw" &&
          context.intentOperationParams.quote !== null
        ) {
          return {
            ...context.intentOperationParams,
            quote: determineNewestValidQuote(
              context.intentOperationParams.tokenOut,
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
          tokenDeltas: accountSlippageExactIn(
            context.intentOperationParams.quote.tokenDeltas,
            context.slippageBasisPoints
          ),
          signerId: context.defuseUserId,
          deadlineTimestamp: Math.min(
            Date.now() + settings.swapExpirySec * 1000,
            new Date(
              context.intentOperationParams.quote.expirationTime
            ).getTime()
          ),
          referral: context.referral,
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
          userInfo: { userAddress: string; userChainType: ChainType }
          quoteHashes: string[]
        }
      }) =>
        publishIntent(input.signatureData, input.userInfo, input.quoteHashes)
    ),
    pollIntentStatus: fromPromise(
      ({
        input,
        signal,
      }: {
        input: { intentHash: string }
        signal: AbortSignal
      }) => waitForIntentSettlement(signal, input.intentHash)
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
          new Date(
            context.intentOperationParams.quote.expirationTime
          ).getTime() > Date.now()
        )
      }

      return true
    },
    isSigned: (_, params: WalletSignatureResult | null) => params != null,
    isTrue: (_, params: boolean) => params,
    isOk: (_, params: { tag: "ok" } | { tag: "err" }) => params.tag === "ok",
    isQuoteOk: ({ event }) => {
      return event.params.quote.tag === "ok"
    },
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
        case "swap": {
          return {
            tag: "ok",
            value: {
              intentHash: context.intentHash,
              intentDescription: {
                type: "swap",
                quote: context.intentOperationParams.quote,
                totalAmountIn: negateTokenValue(
                  computeTotalDeltaDifferentDecimals(
                    context.intentOperationParams.tokensIn,
                    context.intentOperationParams.quote.tokenDeltas
                  )
                ),
                totalAmountOut: computeTotalDeltaDifferentDecimals(
                  [context.intentOperationParams.tokenOut],
                  context.intentOperationParams.quote.tokenDeltas
                ),
              },
            },
          }
        }
        case "withdraw": {
          return {
            tag: "ok",
            value: {
              intentHash: context.intentHash,
              intentDescription: {
                type: "withdraw",
                amountWithdrawn: calcOperationAmountOut(
                  context.intentOperationParams
                ),
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
      guard: "isQuoteOk",
      actions: [
        {
          type: "proposeQuote",
          params: ({ event }) => event.params.quote.value as AggregatedQuote,
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
                reason: extractWalletErrorCode(
                  event.error,
                  "ERR_USER_DIDNT_SIGN"
                ),
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
              type: "isOk",
              params: ({ event }) => event.output,
            },
          },
          {
            target: "Generic Error",
            description: "ERR_PUBKEY_*",

            actions: {
              type: "setError",
              params: ({ event }) => {
                assert(event.output.tag === "err", "Expected error")
                return {
                  reason: event.output.value,
                  error: null,
                }
              },
            },
          },
        ],
        onError: {
          target: "Generic Error",
          description: "ERR_PUBKEY_EXCEPTION",

          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => ({
                reason: "ERR_PUBKEY_EXCEPTION",
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
          if (
            context.intentOperationParams.type === "withdraw" &&
            context.intentOperationParams.nep141Storage &&
            context.intentOperationParams.nep141Storage.quote
          ) {
            quoteHashes.push(
              ...context.intentOperationParams.nep141Storage.quote.quoteHashes
            )
          }

          return {
            signatureData: context.signature,
            userInfo: {
              userAddress: context.userAddress,
              userChainType: context.userChainType,
            },
            quoteHashes,
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

        onDone: [
          {
            target: "Completed",
            guard: {
              type: "isOk",
              params: ({ event }) => event.output,
            },
            actions: {
              type: "setIntentHash",
              params: ({ event }) => {
                assert(event.output.tag === "ok")
                return event.output.value
              },
            },
          },
          {
            target: "Generic Error",
            actions: {
              type: "setError",
              params: ({ event }) => {
                assert(event.output.tag === "err")
                return {
                  reason: "ERR_CANNOT_PUBLISH_INTENT",
                  server_reason: event.output.value.reason,
                }
              },
            },
          },
        ],
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

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("unknown error")
}

function determineNewestValidQuote(
  tokenOut: BaseTokenInfo,
  originalQuote: AggregatedQuote,
  proposedQuote: AggregatedQuote
): AggregatedQuote {
  const out1 = computeTotalDeltaDifferentDecimals(
    [tokenOut],
    originalQuote.tokenDeltas
  )
  const out2 = computeTotalDeltaDifferentDecimals(
    [tokenOut],
    proposedQuote.tokenDeltas
  )
  if (
    compareAmounts(out1, out2) <= 0 &&
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
    case "SOLANA": {
      return sign.detached.verify(
        signature.signedData.message,
        signature.signatureData,
        base58.decode(userAddress)
      )
    }
    default:
      signatureType satisfies never
      throw new Error("exhaustive check failed")
  }
}

export function calcOperationAmountOut(
  operation: IntentOperationParams
): TokenValue {
  const operationType = operation.type
  switch (operationType) {
    case "swap":
      return computeTotalDeltaDifferentDecimals(
        [operation.tokenOut],
        operation.quote.tokenDeltas
      )

    case "withdraw":
      return calcWithdrawAmount(
        operation.tokenOut,
        operation.quote,
        operation.nep141Storage,
        operation.directWithdrawalAmount
      )

    default:
      operationType satisfies never
      throw new Error("exhaustive check failed")
  }
}

export function calcWithdrawAmount(
  tokenOut: BaseTokenInfo,
  swapInfo: AggregatedQuote | null,
  nep141Storage: NEP141StorageRequirement | null,
  directWithdrawalAmount: TokenValue
): TokenValue {
  const gotFromSwap =
    swapInfo == null
      ? { amount: 0n, decimals: 0 }
      : computeTotalDeltaDifferentDecimals([tokenOut], swapInfo.tokenDeltas)

  let spentOnStorage: TokenValue = { amount: 0n, decimals: 0 }
  if (nep141Storage != null) {
    if (nep141Storage.type === "no_swap_needed") {
      // Assume that token out is NEAR/wNEAR, so we can just use the required storage
      spentOnStorage = {
        amount: nep141Storage.requiredStorageNEAR,
        decimals: tokenOut.decimals,
      }
    } else {
      spentOnStorage = computeTotalDeltaDifferentDecimals(
        [tokenOut],
        nep141Storage.quote.tokenDeltas
      )
      // NEP-141 Storage quote will sell `tokenOut` for storage token (wNEAR), so it will be a negative number.
      // We need to negate it to get the amount of `tokenOut` spent on storage.
      spentOnStorage.amount = -spentOnStorage.amount
    }
  }

  return subtractAmounts(
    addAmounts(directWithdrawalAmount, gotFromSwap),
    spentOnStorage
  )
}
