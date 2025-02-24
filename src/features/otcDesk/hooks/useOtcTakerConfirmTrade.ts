import { useMutation } from "@tanstack/react-query"
import { Err, type Result } from "@thames/monads"
import { useContext } from "react"
import {
  type SignerCredentials,
  formatSignedIntent,
} from "../../../core/formatters"
import { createSwapIntentMessage } from "../../../core/messages"
import {
  type PublishIntentsErr,
  type PublishIntentsOk,
  publishIntents,
} from "../../../services/intentService"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import {
  SignIntentContext,
  type SignIntentErr,
} from "../providers/SignIntentActorProvider"
import type { SignMessage } from "../types/sharedTypes"
import {
  type AggregatedQuoteErr,
  getFreshQuoteHashes,
} from "../utils/quoteUtils"
import type { OTCTakerPreparationOk } from "./useOtcTakerPreparation"

export function useOtcTakerConfirmTrade({
  makerMultiPayloadPlain,
  signMessage,
  onSuccessTrade,
}: {
  makerMultiPayloadPlain: MultiPayload | string
  signMessage: SignMessage
  onSuccessTrade: (arg: { intentHashes: string[] }) => void
}) {
  const { signIntent } = useContext(SignIntentContext)

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

      return publishIntents({
        quote_hashes: quoteHashesResult.unwrap(),
        signed_datas: [
          multiPayload,
          typeof makerMultiPayloadPlain === "string"
            ? JSON.parse(makerMultiPayloadPlain)
            : makerMultiPayloadPlain,
        ],
      })
    },

    onSuccess: (data, _variables) => {
      data.map((intentHashes) => {
        onSuccessTrade({ intentHashes })
        return null
      })
    },
  })
}
