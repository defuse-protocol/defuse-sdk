import { Err, Ok } from "@thames/monads"
import { assert } from "src/utils/assert"
import {
  computeTotalBalanceDifferentDecimals,
  getUnderlyingBaseTokenInfos,
} from "src/utils/tokenUtils"
import { ButtonCustom } from "../../../components/Button/ButtonCustom"
import type { SignerCredentials } from "../../../core/formatters"
import { useGiftTakerConfirmClaim } from "../hooks/useGiftTakerConfirmClaim"
import type { GiftTerms } from "../utils/deriveGiftTerms"
import { signGiftTakerMessage } from "../utils/signGiftTakerMessage"
import { ShareableGiftImage } from "./ShareableGiftImage"

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
  const amountIn = computeTotalBalanceDifferentDecimals(
    getUnderlyingBaseTokenInfos(giftTerms.tokenIn),
    giftTerms.tokenDiff,
    { strict: false }
  )

  assert(amountIn != null)

  const confirmTradeMutation = useGiftTakerConfirmClaim()

  return (
    <div className="flex flex-col">
      {/* Header Section */}
      <div className="flex flex-row justify-between mb-5">
        <div className="flex flex-col items-start gap-1.5">
          <div className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-2">
            You've received a gift!
          </div>
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Sign in to claim it, no hidden fees or strings attached.
          </div>
        </div>
      </div>

      {/* Image Section */}
      <ShareableGiftImage
        token={giftTerms.tokenIn}
        amountIn={amountIn}
        message="You've received a gift! Click to claim it."
      />

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
