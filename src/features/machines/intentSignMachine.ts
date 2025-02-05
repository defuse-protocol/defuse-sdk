import { base58 } from "@scure/base"
import type { providers } from "near-api-js"
import { sign } from "tweetnacl"
import { verifyMessage as verifyMessageViem } from "viem"
import { assign, fromPromise, setup } from "xstate"
import { settings } from "../../config/settings"
import { logger } from "../../logger"
import { publishIntent } from "../../services/intentService"
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
import { PriorityQueue } from "../../utils/priorityQueue"
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

export type IntentOperationParams =
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
    }
  | {
      type: "withdraw"
      amountWithdrawn: TokenValue
    }

export type Errors = null | {
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

type Context = {
  userAddress: string
  userChainType: ChainType
  defuseUserId: DefuseUserId
  referral?: string
  slippageBasisPoints: number
  nearClient: providers.Provider
  sendNearTransaction: SendNearTransaction
  intentOperationParams: IntentOperationParams
  // The best quote that was actually published or will be published
  quoteToPublish: AggregatedQuote | null
  // Queue stores all quotes coming from the background quoter
  quotes: PriorityQueue<AggregatedQuote>
  messageToSign: null | {
    walletMessage: WalletMessage
    innerMessage: Nep413DefuseMessageFor_DefuseIntents
  }
  signature: WalletSignatureResult | null
  intentHash: string | null
  error: Errors
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
  | NonNullable<Errors>
  | {
      tag: "ok"
      value: {
        userAddress: string
        userChainType: ChainType
        defuseUserId: DefuseUserId
        referral?: string
        slippageBasisPoints: number
        nearClient: providers.Provider
        sendNearTransaction: SendNearTransaction
        intentOperationParams: IntentOperationParams
        quoteToPublish: AggregatedQuote | null
        quotes: PriorityQueue<AggregatedQuote>
        messageToSign: {
          walletMessage: WalletMessage
          innerMessage: Nep413DefuseMessageFor_DefuseIntents
        }
        signature: WalletSignatureResult
        intentDescription: IntentDescription
      }
    }

type Events = BackgroundQuoterEvents

export const intentSignMachine = setup({
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
    proposeQuote: ({ context }, proposedQuote: AggregatedQuote) => {
      if (context.intentOperationParams.quote) {
        enqueueBetterQuote(
          context.quotes,
          context.intentOperationParams.quote,
          proposedQuote,
          context.intentOperationParams.tokenOut,
          context.slippageBasisPoints
        )
      }
    },
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
          deadlineTimestamp: Date.now() + settings.swapExpirySec * 1000,
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
    dequeueValidQuote: assign({
      quoteToPublish: ({ context }) => dequeueValidQuote(context.quotes),
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
  },
  guards: {
    isSettled: (
      _,
      { status }: { status: "SETTLED" } | { status: "NOT_FOUND_OR_NOT_VALID" }
    ) => {
      return status === "SETTLED"
    },
    isIntentRelevant: ({ context }) => {
      const hadQuote = context.intentOperationParams.quote != null
      const hasQuote = context.quoteToPublish != null
      return hadQuote === hasQuote
    },
    isTrue: (_, params: boolean) => params,
    isOk: (_, params: { tag: "ok" } | { tag: "err" }) => params.tag === "ok",
    isQuoteOk: ({ event }) => {
      return event.params.quote.tag === "ok"
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEsB2AXMGC0tlVQGIA5AUQHUB9ARQFUB5AFVIG0AGAXUVAAcB7POmR9U3EAA9E2AIxsArADppANjkAWAJwAOAMzLdWuQHYtAGhABPKTp1qFAJh1t7ytcqPG2RnQF8f5tEwcPAIFZAgAGzBCdi4kEH5BYVF4yQRpXQU5cysEbDUtPwCMLHRcfFQFAGUKtChCCBEwMNQANz4Aa2aQ1ABZOFgAQxhYsUTkIRExNOl7aQV5NTUvV1sdWQ0cxHstIwXVGx0NNg17DQyikEDS8tCagjrCMAAnZ75nhR4IwfQAM3eALYKHr9WBDEacMYCCbJaZSFx2Ni2FSnexyY5aDTZSyILTzGyqORaJZGdzKc6Xa7BCoKABqL2QvwsdQABPdUD8AK7PaKNVDNNDtLotIJlHp0hlM1nsrk8hCCvgAYx+yVio3i40mKVAaWUbAUah0eJMcmkyzkTmxuVcWiyO1NSy0bGksjklJK1NC9OejOZqCgbIqst5TRaQoFHrFNO9vulQfQ3LA8raSpVIjV0jivGhWrheVsdls9lJZw8GKxWwQyjNCi0etJymRKj07tFt0qMal-sDBGDT1e70+3z+gJFN3Fnb9AZlCblCuVWrVkI1OdhqWsbGUCj09jOal36LYmKtiEN+oK3mk6kbRiMWKMrfH0clU5ZAAVOQAjCLIRUsgDSYAWO+PKwFgiohvyYadM0PBfj+iqARYnbIC8ABKYC-Oq2ZJFM65Vlu+6uOipLmmcmw4ggGh3kojhqLe8iYrs0iPp6HYvqyH7fr+AFASBcDgZBEbhp88G-khKHoZhLCZlCuHahI1iGgsmh3vuaLlie6TOvMuzEuSGjaGwmgaKxUZehx3ZcQhvHAW+oGCf2bwfF8Pz-M8QJwdxiFAZJzwYVhy44TCeE6vChgGo2hjuBpR4VpRZa1usmLSDYhjrH4-ggKgfAQHAYhUuZCmamuYX5qc277iW1GHselbYPYzgKCYaizBojayDoRjyGZ7ZhJEYBySFCkzK4DjEoY6i7o1mhqPVLqKDsrVzG48gZGcvXiuydRDbm+EeA4u6qMoaKVliWRHPoBakqSFJZYVfWTnGvazoNK7yXmt4LF4poqEYu7GRoc2UUsdjksZyxuF1d7GJtz4+l2AbWTxSH8WBqAQbtpWKQgu7NSdRz-a48jkTolYmDoChA14siGqSWhaPYcOhAAwnwAJfGAmAQFjoU46liiMwU1EIvITj2JWLraAaRqbqSchsM6hrM5UADiWAMn+pADs8vMjfCqgLOLJ01ZpkvSNLhpOmSCtK74mVAA */
  context: ({ input }) => {
    const quotes = makeQuotePriorityQueue(input.intentOperationParams.tokenOut)
    if (input.intentOperationParams.quote != null) {
      quotes.enqueue(input.intentOperationParams.quote)
    }

    return {
      messageToSign: null,
      signature: null,
      error: null,
      intentHash: null,
      quotes,
      quoteToPublish: null,
      ...input,
    }
  },

  id: "intent-sign",

  initial: "idle",

  output: ({ context }): Output => {
    if (context.signature != null && context.messageToSign != null) {
      const intentType = context.intentOperationParams.type
      switch (intentType) {
        case "swap": {
          const quote = context.quoteToPublish
          assert(quote != null, "Quote must be set for swap intent")

          return {
            tag: "ok",
            value: {
              ...context,
              messageToSign: context.messageToSign,
              signature: context.signature,
              intentDescription: {
                type: "swap",
                totalAmountIn: negateTokenValue(
                  computeTotalDeltaDifferentDecimals(
                    context.intentOperationParams.tokensIn,
                    quote.tokenDeltas
                  )
                ),
                totalAmountOut: computeTotalDeltaDifferentDecimals(
                  [context.intentOperationParams.tokenOut],
                  quote.tokenDeltas
                ),
              },
            },
          }
        }
        case "withdraw": {
          return {
            tag: "ok",
            value: {
              ...context,
              messageToSign: context.messageToSign,
              signature: context.signature,
              intentDescription: {
                type: "withdraw",
                amountWithdrawn: calcOperationAmountOut(
                  context.intentOperationParams,
                  context.quoteToPublish
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
            target: "Completed",

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
      exit: "dequeueValidQuote",
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

export function enqueueBetterQuote(
  quotes: PriorityQueue<AggregatedQuote>,
  originalQuote: AggregatedQuote,
  proposedQuote: AggregatedQuote,
  tokenOut: BaseTokenInfo,
  slippageBasisPoints: number
) {
  const outOriginal = computeTotalDeltaDifferentDecimals(
    [tokenOut],
    accountSlippageExactIn(originalQuote.tokenDeltas, slippageBasisPoints)
  )

  const outProposed = computeTotalDeltaDifferentDecimals(
    [tokenOut],
    proposedQuote.tokenDeltas
  )

  if (compareAmounts(outOriginal, outProposed) <= 0) {
    quotes.enqueue(proposedQuote)
  }
}

export function dequeueValidQuote(
  quotes: PriorityQueue<AggregatedQuote>
): AggregatedQuote | null {
  const MIN_BUFFER_TIME_MS = 10_000 // 10 seconds

  while (!quotes.isEmpty()) {
    const quote = quotes.dequeue()
    if (
      // We take a quote that won't expire in the next 10 seconds, so we have time to broadcast the intent
      Date.now() + MIN_BUFFER_TIME_MS <
      new Date(quote.expirationTime).getTime()
    ) {
      return quote
    }
  }

  return null
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
  operation: IntentOperationParams,
  quoteToPublish: AggregatedQuote | null
): TokenValue {
  const operationType = operation.type
  switch (operationType) {
    case "swap": {
      assert(quoteToPublish != null, "Quote must be set for swap operation")
      return computeTotalDeltaDifferentDecimals(
        [operation.tokenOut],
        quoteToPublish.tokenDeltas
      )
    }

    case "withdraw":
      return calcWithdrawAmount(
        operation.tokenOut,
        quoteToPublish,
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

export function makeQuotePriorityQueue(tokenOut: BaseTokenInfo) {
  return new PriorityQueue<AggregatedQuote>((quoteA, quoteB) => {
    const amountOutA = computeTotalDeltaDifferentDecimals(
      [tokenOut],
      quoteA.tokenDeltas
    )
    const amountOutB = computeTotalDeltaDifferentDecimals(
      [tokenOut],
      quoteB.tokenDeltas
    )
    return compareAmounts(amountOutA, amountOutB)
  })
}
