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
  compareAmounts,
  computeTotalDeltaDifferentDecimals,
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
        | WalletErrorCode
        | PublicKeyVerifierErrorCodes
      error: Error | null
    }
  }
}

type Input = {
  userAddress: string
  userChainType: ChainType
  defuseUserId: DefuseUserId
  referral?: string
  nearClient: providers.Provider
  sendNearTransaction: SendNearTransaction
  intentOperationParams: IntentOperationParams
}

export type Output =
  | NonNullable<Context["error"]>
  | {
      tag: "ok"
      value: {
        intentOperationParams: IntentOperationParams
        signature: WalletSignatureResult
        userAddress: string
        userChainType: ChainType
      }
    }

type Events = BackgroundQuoterEvents

export const intentSignerMachine = setup({
  types: {
    context: {} as Context,
    input: {} as Input,
    output: {} as Output,
    events: {} as Events,
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
          tokenDeltas: context.intentOperationParams.quote.tokenDeltas,
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
  /** @xstate-layout N4IgpgJg5mDOIC5QEsB2AXMGC0tlVTACcBiAOQFEB1AfQEUBVAeQBUKBtABgF1FQAHAPZ50yQaj4gAHogCMAJgCcAOgAcAFkUA2AMwB2WYtWy9e+aoA0IAJ6Jsm9cvWddezqvkv1WxeoC+flZomDh4BMTKyBAANmAkXLxIIEIiYhJJMgg6sjrKspyyAKxa8oVWtgjYhnrKnNmlAUEYWOi4+IREygDK7WhQJBDiYJGoAG6CANbDYagAsnCwAIYwCZIpyKLikpnyWoXKOoWF3qp6ZTaImsol+Yr6hY0gwS1t4Z09BH0kxESCnfzRRboABmfwAtsoZvNYEsVjw1sINmltnY9I5OPIdOp7uU7DlcjotAYzPJ1Apbv5Ak9mqF2hEAGrEZDA6x9AAEH1QQIArkQ4oNCCNxlMRiFWjMGUyWezOTy+Qg0OMAMZAtIJVZJdabdKgTLVNSeernCo6bS1OqKFwNKnPWlvZSMojM1moKAc9py-lDIWTYa28V0zqO50yj3oXlgBVjQQq7Xq2SJASI7UoypFRw6HSGhTGxCHGryUxY+6Pf2vDoOqUut2y8N875EX7-QEg8Gil4SoNV0MET1R5Wq8Tq+Ga5PIjJ42RaA6FIolXMIIqca4FYrWqmoQQQOCSMudhGpLYTyqeeQHLN1HO4yqE5dTvTaU4PG00gP2qKxA9Io+6vNTg6+IURrXtghZnloRKPmcpavuWEScn0X4pseniOB46jyLIT4gbIhh5FozjzjBYpwV2TrSq67q9nWYBIeOv4IPISh5CYWFnNeJg1KonAnNBL4kZ2ygAMKCGCAJgJgEB0T+0iIIWuSeG4wEXAgQHLk+xEdoGygAOJYEySpshQjZ-NJOqyZUZy1IYQFXipalqHxARAA */
  context: ({ input }) => {
    return {
      messageToSign: null,
      signature: null,
      error: null,
      intentHash: null,
      ...input,
    }
  },

  id: "intent-signer",

  initial: "idle",

  output: ({ context }): Output => {
    if (context.signature != null) {
      return {
        tag: "ok",
        value: {
          intentOperationParams: context.intentOperationParams,
          signature: context.signature,
          userAddress: context.userAddress,
          userChainType: context.userChainType,
        },
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
            target: "Completed",

            guard: {
              type: "isTrue",
              params: ({ event }) => event.output,
            },

            reenter: true,
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
