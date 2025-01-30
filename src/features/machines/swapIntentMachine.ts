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
  intentProcess: "standard" | "optimistic"
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
  nearClient: providers.Provider
  sendNearTransaction: SendNearTransaction
  intentOperationParams: IntentOperationParams
}

export type Output =
  | NonNullable<Context["error"]>
  | {
      tag: "ok"
      value: {
        intentProcess: "standard"
        intentHash: string
        intentDescription: IntentDescription
      }
    }
  | {
      tag: "ok"
      value: {
        intentProcess: "optimistic"
        intentOperationParams: IntentOperationParams
        signature: WalletSignatureResult
        userAddress: string
        userChainType: ChainType
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
    setIntentFlow: assign({
      intentProcess: (_, intentProcess: "standard" | "optimistic") =>
        intentProcess,
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
    isOptimisticIntent: () => {
      // TODO: Ture if is feature enabled and balance isn't sufficient
      return false
    },
    isSignedAndHeld: () => {
      // TODO: Ture if is feature enabled and held intent data is present
      return false
    },
    isSigned: (_, params: WalletSignatureResult | null) => params != null,
    isTrue: (_, params: boolean) => params,
    isOk: (_, params: { tag: "ok" } | { tag: "err" }) => params.tag === "ok",
    isQuoteOk: ({ event }) => {
      return event.params.quote.tag === "ok"
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaAlgOwBcxCBiAOQFEB1AfQEUBVAeQBUKBtABgF1FQMA9rBwEcAvHxAAPRACYA7ADYAdLIDMATjWLNsgKzbOigDQgAnogAcAFmWXFNrQEYne69Y16Avl9OpMuITEBMo4EAA2YCRcvEgggsKi4pIyCGpqsnbyerKcnNacTrkGeqYWaTl2nPZOGdb2apY2Pn7o2PhEhMoAyjhQePhQJBDiYKF4AG4CANZjwv0AsnCwaDAxkgkiYhJxqZYayhrWtTZO+Vp6nKXmiHryaspXlo2WV4p6zxotIP7tQV29fqDEhgABOoIEoOUGHCaAIADNIQBbZTzPBLWArNY8DZCLbJXaILCyRQHPJ5NwuWTUy5qMqIayVS6vAyWPR6DSWIreXw-NqBTohABqYJw8LMgwABIC8HCAK6gqIjPBjfBTWao-kdYLKEWgsUSvBQaV9WUEBVgBBqgQAYzh2xi6zimySO1AqWpygKilkRS0RkKaj0JhuCFOyjcRw++me8lc31+Ap1eoNUpl8sVw1G43Vcy1-2FovFadNGct1rtrsdTli-DxrpSRLUHmUamq7w0SgyGh09LDLjssmO+0USnq8gT+cFuqLhuN6fNmbBEKhMLhiNBKMT2q6KeLRpN-TLVsmtvt4kdOOd9e2jYQWDUA4yXKaUesSj770syhcz9HjNyNlJwCHdC31fdjQABTlAAjcIcBtSUAGkwDMSVIMVWBiBtJVs2tDUMFg+CbRQsw9xwMEACUwHhJ060SW9CQQWRv00dwmmsdJ-TuENyjObIvXkeROB7IMnCUeRrGAv5pz3Od0KIhDkNQ9DMOw3CVRzGYxkIuCENI8iqJo9ga1xBiCXdBkBPqWQNE4dRfXskS+xcK4fw0cTFC8xxcik3ltwLGdwPk6C9MQ0jVLgdSQXBSFoVhBFkWhRSSNQwzQWo2ir3o-E3WkIlbM4L1bOyfR9Gbd5rBc+yHgUTRFE431fQyaSky6AAhCE0AgO1YFEA8AEkCyzTT8LzEDAs6gRut6-rjSGwUTymSsHR4Oj4hvCz8rSJwvVedwh3kXy1GE64+PkLkf0UVxTicTwJNa0DlCmma0D6qUFuCEbVVPDUAunF6ereubJU+wglrPKs1tM69zLy1J32-YMmmDdkDH4ulQ3Ey6nGuj5jjuniJ38qcdUB2aPuG5c4rXRLN01CaAa6oH3sGgsIZWi81uyja4bvYl9mUBxtHfS4inSK4XJ9TJGWuhw7OODlHsCuTKcFaIeZdRjLLDFQTo8C6hNx0cXPUB4ow+Tx0gUZXZNnNWvpM2tedyu8Cj0VtOWsHQbA5Z4XLcWxfU46xHJZHlWkZnUAAkBHCCBQeG9ata2j0lFUfH0j9i73hck6VAMPJO0fTh0lqW2Y7jhOwYIaIYZyhsmOE5R7kajznjed8XM4h4PBcYSSSOjROQrrowkiOvnZT+HEDOB4uSHTQmkk3yzsQINMleBph1qJx9h8Xk8AECA4Ekf7gjM12mIfTtW3bDku1s3sseH1QvK7YeV40alR5CcewEvo3HWTgCiHH2s2Y4ocjDyD7CxFQShRyKCME0EBHlf49FNIMQB2ttq2S9GcE49w4zZDjFVUMod5Bel0Gcdk9kLp+UjjJZM9sDwLgtNg1OtwHjCRLj6d88g7KB0-GyVsuNOIOHcHkb26DVYHlCsRZSaEMJRTwDhDhM97yuDfp4H0Ai+FuCHH2I4Dwzgxm0Dob+P8SZRw6szCmbNBTqLvB8R4XJOycC7EJZsmM+J6AHG4DxbYqRKD3jIlh80CxOKYq-SwQ495INJNkESMCsa4yKh3BQd1sh2XyOggAwgIJEMIwBEAgFEnWt8BG2QJgoOJw8XLf3SScOyxRLACLUOggA4sQUUiEKCxVBOU7axJSSHB7K4O638s4NM8BGOMCgezPH2FodBsd46J0cbDK+wCtGtyDHZYS9kGh53UO5IuQYmgOCHOggAIjRZckAhmpDjCodsHg8h8JAbIbuIk9ptneJoI6igD5eCAA */
  context: ({ input }) => {
    return {
      messageToSign: null,
      signature: null,
      error: null,
      intentHash: null,
      intentProcess: "standard",
      ...input,
    }
  },

  id: "swap-intent",

  initial: "idle",

  output: ({ context }): Output => {
    if (context.intentProcess === "optimistic") {
      assert(context.signature != null, "Signature is not set")
      return {
        tag: "ok",
        value: {
          intentProcess: "optimistic",
          intentOperationParams: context.intentOperationParams,
          signature: context.signature,
          userAddress: context.userAddress,
          userChainType: context.userChainType,
        },
      }
    }
    if (context.intentHash != null) {
      const intentType = context.intentOperationParams.type
      switch (intentType) {
        case "swap": {
          return {
            tag: "ok",
            value: {
              intentProcess: "standard",
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
              intentProcess: "standard",
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
      always: [
        {
          target: "Verifying Signature",
          guard: "isSignedAndHeld",
          reenter: true,
        },
        "Signing",
      ],
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
          target: "Hold Intent",
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

    "Hold Intent": {
      always: [
        {
          target: "Deferred",
          guard: "isOptimisticIntent",
          actions: [
            {
              type: "setIntentFlow",
              params: "optimistic",
            },
          ],
        },
        {
          target: "Broadcasting Intent",
        },
      ],
    },

    Deferred: {
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
