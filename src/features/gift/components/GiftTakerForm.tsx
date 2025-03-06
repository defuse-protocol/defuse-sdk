import { Err, Ok } from "@thames/monads"
import { ButtonCustom } from "../../../components/Button/ButtonCustom"
import type { SignerCredentials } from "../../../core/formatters"
import { useGiftTakerConfirmClaim } from "../hooks/useGiftTakerConfirmClaim"
import type { GiftTerms } from "../utils/deriveGiftTerms"
import { signGiftTakerMessage } from "../utils/signGiftTakerMessage"

export type GiftTakerFormProps = {
  giftTerms: GiftTerms
  signerCredentials: SignerCredentials | null
  onSuccessClaim: (arg: { intentHashes: string[] }) => void
}

export function GiftTakerForm({
  giftTerms,
  signerCredentials,
  onSuccessClaim,
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
                          onSuccessClaim({ intentHashes: [intentHash] })
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
