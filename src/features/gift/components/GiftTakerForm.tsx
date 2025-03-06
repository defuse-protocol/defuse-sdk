import { Err, Ok } from "@thames/monads"
import { ButtonCustom } from "../../../components/Button/ButtonCustom"
import type { SignerCredentials } from "../../../core/formatters"
import { useGiftTakerConfirmClaim } from "../hooks/useGiftTakerConfirmClaim"
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
  onSuccessClame,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  referral,
}: GiftTakerFormProps) {
  const confirmTradeMutation = useGiftTakerConfirmClaim()

  return (
    <div className="flex flex-col">
      {confirmTradeMutation.data?.match({
        ok: () => <div>Gift claimed!</div>,
        err: (err) => <div className="text-red-700">{err.reason}</div>,
      })}
      <ButtonCustom
        onClick={() => {
          if (!confirmTradeMutation.isPending && signerCredentials != null) {
            signGiftTakerMessage({
              giftTerms,
              signerCredentials,
            }).then((signatureResult) => {
              if (signatureResult.isOk()) {
                confirmTradeMutation.mutate(
                  {
                    signature: signatureResult.unwrap(),
                    signerCredentials,
                  },
                  {
                    onSuccess: (result) => {
                      if (result.isErr()) {
                        return Err(result.unwrapErr())
                      }
                      if (result.isOk()) {
                        const intentHashes = result.unwrap()
                        const intentHash = intentHashes[0]
                        if (intentHash) {
                          onSuccessClame({ intentHashes: [intentHash] })
                        }
                      }
                      return Ok(signatureResult)
                    },
                  }
                )
              }
              return signatureResult.isErr()
                ? Err(signatureResult.unwrapErr())
                : Ok(signatureResult)
            })
          }
        }}
        type="button"
        size="lg"
        className="mt-5"
        variant={confirmTradeMutation.isPending ? "secondary" : "primary"}
        isLoading={confirmTradeMutation.isPending}
      >
        {confirmTradeMutation.isPending ? "Processing..." : "Claim gift"}
      </ButtonCustom>
    </div>
  )
}
