import { base64 } from "@scure/base"
import { assertEvent, setup } from "xstate"
import {
  type SignerCredentials,
  formatSignedIntent,
} from "../../../core/formatters"
import { createTransferMessage } from "../../../core/messages"
import { logger } from "../../../logger"
import {
  AmountMismatchError,
  calculateSplitAmounts,
} from "../../../services/quoteService"
import type {
  BaseTokenInfo,
  TokenValue,
  UnifiedTokenInfo,
} from "../../../types/base"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import type { WalletMessage, WalletSignatureResult } from "../../../types/swap"
import { findError } from "../../../utils/errors"
import { randomDefuseNonce } from "../../../utils/messageFactory"
import {
  adjustDecimals,
  getAnyBaseTokenInfo,
  getUnderlyingBaseTokenInfos,
} from "../../../utils/tokenUtils"
import type { BalanceMapping } from "../../machines/depositedBalanceMachine"
import {
  type Errors as SignIntentErrors,
  signIntentMachine,
} from "../../machines/signIntentMachine"
import type { SignMessage } from "../types/sharedTypes"
import type { EscrowKeyPair } from "./giftMakerEscrowActor"

export type GiftMakerSignActorInput = {
  parsed: {
    tokenIn: BaseTokenInfo | UnifiedTokenInfo
    amountIn: TokenValue
    message: string
  }
  balances: BalanceMapping
  signerCredentials: SignerCredentials
  signMessage: SignMessage
  referral: string | undefined
  escrowKeyPair: EscrowKeyPair
}

export type GiftMakerSignActorOutput =
  | { tag: "err"; value: GiftMakerSignActorErrors }
  | { tag: "ok"; value: GiftMakerSignActorSuccess }

export type GiftMakerSignActorSuccess = {
  // TODO: we need here only private key
  multiPayload: MultiPayload
  signatureResult: WalletSignatureResult
  signerCredentials: SignerCredentials
  usedNonceBase64: string
  escrowKeyPair: EscrowKeyPair
}

export type GiftMakerSignActorContext = {
  nonce: Uint8Array
  parsed: GiftMakerSignActorInput["parsed"]
  signerCredentials: GiftMakerSignActorInput["signerCredentials"]
  walletMessage: WalletMessage
  escrowKeyPair: EscrowKeyPair
}

export type GiftMakerSignActorErrors =
  | SignIntentErrors
  | { reason: "EXCEPTION" }

export const giftMakerSignActor = setup({
  types: {
    input: {} as GiftMakerSignActorInput,
    output: {} as GiftMakerSignActorOutput,
    context: {} as GiftMakerSignActorContext,
    events: {} as
      | { type: "xstate.init"; input: GiftMakerSignActorInput }
      | { type: "COMPLETE"; output: GiftMakerSignActorOutput },
  },
  actors: {
    signActor: signIntentMachine,
  },
  actions: {
    logError: (_, event: { error: unknown }) => {
      logger.error(event.error)
    },
    complete: ({ self }, output: GiftMakerSignActorOutput) => {
      self.send({ type: "COMPLETE", output })
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOllynwKgGIIB7QkggN3oGswyL8AlMAGYBtAAwBdRKAAO9cgBdcjSSAAeiAIwBOACwkRADk36ArIZEA2Y+pFGANCACeicyQDsr9Sc0XjAZm3mNgBMAL4h9mhYeISk5JTUNGAATkn0SSRSADbocgJpqNyU-MLiyjLyivjKaggAtMZBJL6uxiK++tqaQa3mHeb2Tggu7p7G3pb+gV1hERg4BMSFVPi0AMIA8gCyAAoAMgCiACr7ohJIIOW4CkrnNdoiriTm6kFB5r6+xla+mv2OiLVzI99J8gq4ROogQZ9OpXGFwiB8PQIHBlJF5jEyrIrpVqgDrCImi02h0uj0TAMAUFISRtOp6a8Gi9-O0ZiB0dFFnFllAsRUbqA7oSwZpfD4Ya5tGNjH9BrUXvoSJp6S9lWLtPpXB02RyFqRMPRUFkwHJIHycQLVIgfroglKHi8ZR9PpSEPdaZLNK5la11L4Xq5zPCQkA */
  initial: "signing",

  context: ({ input }) => {
    const nonce = randomDefuseNonce()

    let tokenInDiff: Record<BaseTokenInfo["defuseAssetId"], bigint>

    try {
      tokenInDiff = calculateSplitAmounts(
        getUnderlyingBaseTokenInfos(input.parsed.tokenIn),
        input.parsed.amountIn,
        input.balances
      )

      for (const [assetId, amount] of Object.entries(tokenInDiff)) {
        // We need to negate the amount, as the balance is being reduced
        tokenInDiff[assetId] = -amount
      }
    } catch (err: unknown) {
      if (!findError(err, AmountMismatchError)) {
        throw err
      }

      /**
       * If user has insufficient balance, we will generate a message with the full amount,
       * and let the user know that they have insufficient balance.
       */
      const tokenIn = getAnyBaseTokenInfo(input.parsed.tokenIn)
      tokenInDiff = {
        [tokenIn.defuseAssetId]: adjustDecimals(
          // We need to negate the amount, as the balance is being reduced
          input.parsed.amountIn.amount,
          input.parsed.amountIn.decimals,
          tokenIn.decimals
        ),
      }
    }

    const walletMessage = createTransferMessage(
      [...Object.entries(tokenInDiff)],
      {
        signerId: input.signerCredentials,
        nonce: nonce,
        referral: input.referral,
        memo:
          input.parsed.message.length > 0
            ? input.parsed.message
            : "Enjoy your gift!",
        receiverId: input.escrowKeyPair.userId,
      }
    )

    return {
      nonce,
      walletMessage,
      parsed: input.parsed,
      signerCredentials: input.signerCredentials,
      escrowKeyPair: input.escrowKeyPair,
    }
  },

  output: ({ event }) => {
    return event.output as GiftMakerSignActorOutput
  },

  states: {
    signing: {
      invoke: {
        id: "signRef",
        src: "signActor",

        input: ({ event, context }) => {
          assertEvent(event, "xstate.init")
          const input = event.input as GiftMakerSignActorInput

          return {
            signMessage: input.signMessage,
            signerCredentials: context.signerCredentials,
            walletMessage: context.walletMessage,
          }
        },

        onError: {
          actions: [
            { type: "logError", params: ({ event }) => event },
            {
              type: "complete",
              params: { tag: "err", value: { reason: "EXCEPTION" } },
            },
          ],
        },

        // @ts-expect-error wtf???
        onDone: {
          actions: [
            {
              type: "complete",
              params: ({ event }) => event.output,
            },
          ],
        },
      },

      on: {
        COMPLETE: "completed",
      },
    },

    completed: {
      type: "final",
      output: ({ context, event }): GiftMakerSignActorOutput => {
        assertEvent(event, "COMPLETE")

        if (event.output.tag === "err") {
          return event.output
        }

        const multiPayload = formatSignedIntent(
          event.output.value.signatureResult,
          context.signerCredentials
        )

        return {
          tag: "ok",
          value: {
            multiPayload,
            signatureResult: event.output.value.signatureResult,
            signerCredentials: context.signerCredentials,
            usedNonceBase64: base64.encode(context.nonce),
            escrowKeyPair: context.escrowKeyPair,
          },
        }
      },
    },
  },
})
