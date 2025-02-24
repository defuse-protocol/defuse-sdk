import { useMutation } from "@tanstack/react-query"
import { Err, Ok } from "@thames/monads"
import {
  type SignerCredentials,
  formatSignedIntent,
} from "../../../core/formatters"
import { createSwapIntentMessage } from "../../../core/messages"
import { publishIntents } from "../../../services/solverRelayHttpClient"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import type { ExtractOk, SignMessage } from "../types/sharedTypes"
import { getFreshQuoteHashes } from "../utils/quoteUtils"
import type { OTCTakerPreparationResult } from "./useOtcTakerPreparation"

export function useOtcTakerConfirmTrade({
  makerMultiPayloadPlain,
  signMessage,
}: {
  preparationResult: OTCTakerPreparationResult | undefined
  makerMultiPayloadPlain: MultiPayload | string
  signMessage: SignMessage
  signerCredentials: SignerCredentials | null
}) {
  return useMutation({
    mutationKey: ["confirm_swap"],
    mutationFn: async ({
      signerCredentials,
      preparation,
    }: {
      signerCredentials: SignerCredentials
      preparation: ExtractOk<OTCTakerPreparationResult>
    }) => {
      const signerId = userAddressToDefuseUserId(
        signerCredentials.credential,
        signerCredentials.credentialType
      )

      const { quotes, quoteParams, tokenDiff } = preparation

      const walletMessage = createSwapIntentMessage(tokenDiff, {
        signerId: signerId,
      })
      const signatureResult = await signMessage(walletMessage)
      if (signatureResult == null) {
        throw new Error("Didn't sign or failed")
      }

      // It's totally alright do async stuff after singing
      const quoteHashes = await getFreshQuoteHashes(quotes, quoteParams).then(
        (r) => r.unwrap()
      )

      const multiPayload = formatSignedIntent(
        signatureResult,
        signerCredentials
      )

      const result = await publishIntents({
        quote_hashes: quoteHashes,
        signed_datas: [
          multiPayload,
          typeof makerMultiPayloadPlain === "string"
            ? JSON.parse(makerMultiPayloadPlain)
            : makerMultiPayloadPlain,
        ],
      }).then(parsePublishIntentsResponse)

      return result.unwrap()
    },
  })
}

function parsePublishIntentsResponse(
  response: Awaited<ReturnType<typeof publishIntents>>
) {
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

  return Err({
    reason: "RELAY_PUBLISH_UNKNOWN_ERROR",
    serverReason: response.reason,
  })
}
