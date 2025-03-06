import { useMutation } from "@tanstack/react-query"
import {
  type SignerCredentials,
  formatSignedIntent,
} from "../../../core/formatters"
import { publishIntents } from "../../../services/intentService"
import type { NEP413SignatureData } from "../../../types/swap"

export function useGiftTakerConfirmClaim() {
  return useMutation({
    mutationKey: ["confirm_gift"],
    mutationFn: async ({
      signature,
      signerCredentials,
    }: {
      signature: NEP413SignatureData
      signerCredentials: SignerCredentials
    }) => {
      const multiPayload = formatSignedIntent(signature, signerCredentials)

      const result = await publishIntents({
        quote_hashes: [],
        signed_datas: [multiPayload],
      })
      // biome-ignore lint/suspicious/noConsole: <explanation>
      console.log(result)
    },
  })
}
