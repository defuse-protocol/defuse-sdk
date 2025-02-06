import type { providers } from "near-api-js"
import { settings } from "src/config/settings"
import { assign, fromPromise, setup } from "xstate"
import { logger } from "../../logger"
import { publishIntent } from "../../services/intentService"
import type { AggregatedQuote } from "../../services/quoteService"
import type { Nep413DefuseMessageFor_DefuseIntents } from "../../types/defuse-contracts-types"
import type { ChainType } from "../../types/deposit"
import type { WalletMessage, WalletSignatureResult } from "../../types/swap"
import { assert } from "../../utils/assert"
import type { DefuseUserId } from "../../utils/defuse"
import {
  makeInnerSwapMessage,
  makeSwapMessage,
} from "../../utils/messageFactory"
import type { PriorityQueue } from "../../utils/priorityQueue"
import {
  accountSlippageExactIn,
  computeTotalDeltaDifferentDecimals,
  negateTokenValue,
} from "../../utils/tokenUtils"
import type { ParentEvents as BackgroundQuoterEvents } from "./backgroundQuoterMachine"
import {
  type Errors,
  type IntentDescription,
  type IntentOperationParams,
  calcOperationAmountOut,
  dequeueValidQuote,
} from "./intentSignMachine"
import {
  type SendNearTransaction,
  publicKeyVerifierMachine,
} from "./publicKeyVerifierMachine"

type Context = {
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
  quoteToPublish: AggregatedQuote | null
  quotes: PriorityQueue<AggregatedQuote>
  messageToSign: {
    walletMessage: WalletMessage
    innerMessage: Nep413DefuseMessageFor_DefuseIntents
  }
  signature: WalletSignatureResult
  intentDescription: IntentDescription
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

export const intentBroadcastMachine = setup({
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
    dequeueValidQuote: assign({
      quoteToPublish: ({ context }) => dequeueValidQuote(context.quotes),
    }),
    setIntentHash: assign({
      intentHash: (_, intentHash: string) => intentHash,
    }),
  },
  actors: {
    publicKeyVerifierActor: publicKeyVerifierMachine,
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
    isIntentRelevant: ({ context }) => {
      const hadQuote = context.intentOperationParams.quote != null
      const hasQuote = context.quoteToPublish != null
      return hadQuote === hasQuote
    },
    isSigned: (_, params: WalletSignatureResult | null) => params != null,
    isTrue: (_, params: boolean) => params,
    isOk: (_, params: { tag: "ok" } | { tag: "err" }) => params.tag === "ok",
    isQuoteOk: ({ event }) => {
      return event.params.quote.tag === "ok"
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEsB2AXMGC0AjATgPYCGEAxsbOgHTIQA2YAxANoAMAuoqAA6GzJ0yQqm4gAHogBMAFgCs1OQE42MgGxKAzEqnbVAdgA0IAJ6JNCpTKkAOObYCM+rTYfqAvu+NpMOAiXJKGgA1MHxkADMTNCgAAgBJDCx0Vk4xPgEhETFJBAcrail9Zwc2BwcbGW1NYzMEKTdqTRs1TQcpNTYlNTk5fTVPbyS-IlIKKmpQ8KiYhOGUlgcuJBAMwWFRFdyZfSlqGSVXLs1NNm17WsQnBR6lfVP9Ups2R5lBkB9kvFHAiYAhH7jISoOKJXwpCAiMC0VAAN0IAGtoZ8RgEgdQAWigrMwckEGh4RQsqh2BxSel+OtslsrtomjZNDI2MoXjZnDIbJcEDsZNRduo1B0mS9+vp3ij0N8sf9AdiQXNwUxIahkXDEarwVKxkEMbKqDj5vi1USNqTFsteJTiTlENhdHtTgc+ic2J0GUZTIgeXzZGpBWphcVeuL5lrfjRMdr9fLcRgmGEiPhqDx6MR0BFCPgALYwzX+KMRvXA0GGgmEE0iM1pFZra00hDYJz6ajMmwtfRyeQOZRFLlSHRNcpSV2d9m2OSeLwgVCECBwMQSsNAimZDY2hu2NhNVRKZ2nN0yLmNqR7WyyFQ7QUyeSaEN5ou0BhgFdUzagXKyGzUNsnKztXa2IyR6MnyNiyPcDS9CyPR3l8+bhpMYSRNEMbzC+dbvtILw+o8nTdqoGhSFy5S8gc-Zsl0rS6LeU6LvB6KRuGBrguha71g4PTUIcTp+kUJ6VFybRKIobiMky7RMmKtGhvROoAMKEFmKZgJgECsdSmF5EowltJ2DhiWww7qERnoIIKDiKDI+n6OJVR+gM0n3tKNAAOJYEhZCxAAovgibqW+Ei2t2zaaI8mh+kO5EWFy5mWdZtnhX6k7uEAA */
  context: ({ input }) => {
    return {
      ...input,
      intentHash: null,
      error: null,
    }
  },

  id: "intent-broadcast",

  initial: "idle",

  output: ({ context }): Output => {
    if (context.intentHash != null) {
      const intentType = context.intentOperationParams.type
      switch (intentType) {
        case "swap": {
          const quote = context.quoteToPublish
          assert(quote != null, "Quote must be set for swap intent")

          return {
            tag: "ok",
            value: {
              intentHash: context.intentHash,
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
              intentHash: context.intentHash,
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

  states: {
    idle: {
      always: "Verifying Intent",
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

    "Broadcasting Intent": {
      invoke: {
        src: "broadcastMessage",

        input: ({ context }) => {
          assert(context.signature != null, "Signature is not set")
          assert(context.messageToSign != null, "Sign message is not set")

          let quoteHashes: string[] = []
          if (context.quoteToPublish) {
            quoteHashes = quoteHashes.concat(context.quoteToPublish.quoteHashes)
          }

          if (
            context.intentOperationParams.type === "withdraw" &&
            context.intentOperationParams.nep141Storage &&
            context.intentOperationParams.nep141Storage.quote
          ) {
            quoteHashes = quoteHashes.concat(
              context.intentOperationParams.nep141Storage.quote.quoteHashes
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
