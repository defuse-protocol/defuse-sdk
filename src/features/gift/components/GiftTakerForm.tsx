import { useSelector } from "@xstate/react"
import { assert } from "src/utils/assert"
import {
  computeTotalBalanceDifferentDecimals,
  getUnderlyingBaseTokenInfos,
} from "src/utils/tokenUtils"
import type { ActorRefFrom } from "xstate"
import { ButtonCustom } from "../../../components/Button/ButtonCustom"
import type { SignerCredentials } from "../../../core/formatters"
import type { giftTakerRootMachine } from "../actors/giftTakerRootMachine"
import type { GiftInfo } from "../utils/getGiftInfo"
import { ShareableGiftImage } from "./ShareableGiftImage"
import { ErrorReason } from "./shared/ErrorReason"

export type GiftTakerFormProps = {
  giftInfo: GiftInfo
  signerCredentials: SignerCredentials | null
  giftTakerClaimRef: ActorRefFrom<typeof giftTakerRootMachine>
}

export function GiftTakerForm({
  giftInfo,
  signerCredentials,
  giftTakerClaimRef,
}: GiftTakerFormProps) {
  const amount = computeTotalBalanceDifferentDecimals(
    getUnderlyingBaseTokenInfos(giftInfo.token),
    giftInfo.tokenDiff,
    { strict: false }
  )

  const snapshot = useSelector(giftTakerClaimRef, (state) => state)

  const processing = snapshot?.matches("claiming")
  assert(amount != null)

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
        token={giftInfo.token}
        amount={amount}
        message="You've received a gift! Click to claim it."
      />

      {snapshot?.context.error != null &&
        typeof snapshot.context.error?.reason === "string" && (
          <ErrorReason reason={snapshot.context.error?.reason} />
        )}
      {snapshot.status === "done" && (
        <div className="flex justify-center mt-5">Gift claimed!</div>
      )}

      <ButtonCustom
        onClick={() => {
          if (signerCredentials != null && snapshot.status !== "done") {
            giftTakerClaimRef.send({
              type: "CONFIRM_CLAIM",
              params: {
                signerCredentials,
              },
            })
          }
        }}
        type="button"
        size="lg"
        className="mt-5"
        variant={processing ? "secondary" : "primary"}
        isLoading={processing}
      >
        {processing ? "Processing..." : "Claim gift"}
      </ButtonCustom>
    </div>
  )
}
