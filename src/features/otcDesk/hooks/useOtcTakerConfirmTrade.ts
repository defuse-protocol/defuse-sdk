import { useMutation } from "@tanstack/react-query"
import { Err, Ok, type Result } from "@thames/monads"
import {
  type SignerCredentials,
  formatSignedIntent,
} from "../../../core/formatters"
import { createSwapIntentMessage } from "../../../core/messages"
import { publishIntents } from "../../../services/solverRelayHttpClient"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import type { SignMessage } from "../types/sharedTypes"
import {
  type AggregatedQuoteErr,
  getFreshQuoteHashes,
} from "../utils/quoteUtils"
import { type SignIntentErr, signIntent } from "../utils/signIntent"
import type { OTCTakerPreparationOk } from "./useOtcTakerPreparation"

export function useOtcTakerConfirmTrade({
  makerMultiPayloadPlain,
  signMessage,
}: {
  makerMultiPayloadPlain: MultiPayload | string
  signMessage: SignMessage
}) {
  return useMutation({
    mutationKey: ["confirm_swap"],
    mutationFn: async ({
      signerCredentials,
      preparation,
    }: {
      signerCredentials: SignerCredentials
      preparation: OTCTakerPreparationOk
    }): Promise<
      Result<
        PublishIntentsOk,
        PublishIntentsErr | SignIntentErr | AggregatedQuoteErr
      >
    > => {
      const signerId = userAddressToDefuseUserId(
        signerCredentials.credential,
        signerCredentials.credentialType
      )

      const { quotes, quoteParams, tokenDiff } = preparation

      const walletMessage = createSwapIntentMessage(tokenDiff, {
        signerId,
      })

      const signatureResult = await signIntent({
        signerCredentials,
        signMessage,
        walletMessage,
      })
      if (signatureResult.isErr()) {
        return Err(signatureResult.unwrapErr())
      }

      // todo: UI performance: add re-quoting in the background
      // It's totally alright do async stuff after singing
      const quoteHashesResult = await getFreshQuoteHashes(quotes, quoteParams)
      if (quoteHashesResult.isErr()) {
        return Err(quoteHashesResult.unwrapErr())
      }

      const multiPayload = formatSignedIntent(
        signatureResult.unwrap().signatureResult,
        signerCredentials
      )

      // todo: add retry mechanism for publishing for network failures
      return publishIntents({
        quote_hashes: quoteHashesResult.unwrap(),
        signed_datas: [
          multiPayload,
          typeof makerMultiPayloadPlain === "string"
            ? JSON.parse(makerMultiPayloadPlain)
            : makerMultiPayloadPlain,
        ],
      }).then(parsePublishIntentsResponse)
    },
  })
}

type PublishIntentsOk = string[]
type PublishIntentsErr =
  | {
      reason:
        | "RELAY_PUBLISH_SIGNATURE_EXPIRED"
        | "RELAY_PUBLISH_INTERNAL_ERROR"
        | "RELAY_PUBLISH_SIGNATURE_INVALID"
        | "RELAY_PUBLISH_NONCE_USED"
        | "RELAY_PUBLISH_INSUFFICIENT_BALANCE"
    }
  | {
      reason: "RELAY_PUBLISH_UNKNOWN_ERROR"
      serverReason: string
    }

function parsePublishIntentsResponse(
  response: Awaited<ReturnType<typeof publishIntents>>
): Result<PublishIntentsOk, PublishIntentsErr> {
  if (response.status === "OK") {
    return Ok(response.intent_hashes)
  }

  if (response.reason === "already processed") {
    return Ok(response.intent_hashes)
  }

  if (
    response.reason === "expired" ||
    response.reason.includes("deadline has expired")
  ) {
    return Err({ reason: "RELAY_PUBLISH_SIGNATURE_EXPIRED" })
  }

  if (response.reason === "internal") {
    return Err({ reason: "RELAY_PUBLISH_INTERNAL_ERROR" })
  }

  if (response.reason.includes("invalid signature")) {
    return Err({ reason: "RELAY_PUBLISH_SIGNATURE_INVALID" })
  }

  if (response.reason.includes("nonce was already used")) {
    return Err({ reason: "RELAY_PUBLISH_NONCE_USED" })
  }

  if (response.reason.includes("insufficient balance or overflow")) {
    return Err({ reason: "RELAY_PUBLISH_INSUFFICIENT_BALANCE" })
  }

  return Err({
    reason: "RELAY_PUBLISH_UNKNOWN_ERROR",
    serverReason: response.reason,
  })
}
