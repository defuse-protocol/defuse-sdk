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
  publishIntents,
} from "../../../services/intentService"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import {
  SignIntentContext,
  type SignIntentErr,
} from "../providers/SignIntentActorProvider"
import { otcTakerTradesStore } from "../stores/otcTakerTrades"
import type { SignMessage } from "../types/sharedTypes"
import {
  type AggregatedQuoteErr,
  getFreshQuoteHashes,
} from "../utils/quoteUtils"
import type { OTCTakerPreparationOk } from "./useOtcTakerPreparation"

export function useOtcTakerConfirmTrade({
  tradeId,
  makerMultiPayload,
  signMessage,
  onSuccessTrade,
  referral,
}: {
  tradeId: string
  makerMultiPayload: MultiPayload
  signMessage: SignMessage
  onSuccessTrade: (arg: { intentHashes: string[] }) => void
  referral: string | undefined
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
        {
          intentHashes: string[]
          makerMultiPayload: MultiPayload
          takerMultiPayload: MultiPayload
        },
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
        referral,
        memo: "OTC_FILL",
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

      const result = await publishIntents({
        quote_hashes: quoteHashesResult.unwrap(),
        signed_datas: [multiPayload, makerMultiPayload],
      })

      return result.map((intentHashes) => {
        return {
          intentHashes,
          makerMultiPayload,
          takerMultiPayload: multiPayload,
        }
      })
    },

    onSuccess: (data, _variables) => {
      data.map((output) => {
        onSuccessTrade(output)
        otcTakerTradesStore.getState().addCompletedTrade({
          tradeId,
          ...output,
        })
        return null
      })
    },
  })
}
