import { ButtonCustom } from "../../../components/Button/ButtonCustom"
import type { SignerCredentials } from "../../../core/formatters"
import type { SignMessage } from "../types/sharedTypes"
import type { GiftTerms } from "../utils/deriveGiftTerms"
import { signGiftTakerMessage } from "../utils/signGiftTakerMessage"

export type GiftTakerFormProps = {
  giftTerms: GiftTerms
  signerCredentials: SignerCredentials | null
  signMessage: SignMessage
  onSuccessClame: (arg: { intentHashes: string[] }) => void
  referral: string | undefined
}

export function GiftTakerForm({
  giftTerms,
  signerCredentials,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  signMessage,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  onSuccessClame,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  referral,
}: GiftTakerFormProps) {
  const preparation = signGiftTakerMessage({
    giftTerms,
    signerCredentials,
  })
  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.log("preparation", preparation)
  return (
    <div className="flex flex-col">
      <ButtonCustom type="button" size="lg" className="mt-5" variant="primary">
        {signerCredentials ? "Claim gift" : "Sign in"}
      </ButtonCustom>
    </div>
  )
}
