import { useSelector } from "@xstate/react"
import { useCallback } from "react"
import { assert } from "src/utils/assert"
import {
  computeTotalBalanceDifferentDecimals,
  getUnderlyingBaseTokenInfos,
} from "src/utils/tokenUtils"
import type { ActorRefFrom } from "xstate"
import { ButtonCustom } from "../../../components/Button/ButtonCustom"
import type { SignerCredentials } from "../../../core/formatters"
import type { giftTakerRootMachine } from "../actors/giftTakerRootMachine"
import type { GiftInfo } from "../actors/shared/getGiftInfo"
import type { giftClaimActor } from "../actors/shared/giftClaimActor"
import { ShareableGiftImage } from "./ShareableGiftImage"
import { ErrorReason } from "./shared/ErrorReason"

export type GiftTakerFormProps = {
  giftInfo: GiftInfo
  signerCredentials: SignerCredentials | null
  giftTakerRootRef: ActorRefFrom<typeof giftTakerRootMachine>
}

export function GiftTakerForm({
  giftInfo,
  signerCredentials,
  giftTakerRootRef,
}: GiftTakerFormProps) {
  const amount = computeTotalBalanceDifferentDecimals(
    getUnderlyingBaseTokenInfos(giftInfo.token),
    giftInfo.tokenDiff,
    { strict: false }
  )
  const { giftTakerClaimRef, snapshot: giftTakerRootSnapshot } = useSelector(
    giftTakerRootRef,
    (state) => ({
      giftTakerClaimRef: state.children.giftTakerClaimRef as
        | undefined
        | ActorRefFrom<typeof giftClaimActor>,
      snapshot: state,
    })
  )

  const claimGift = useCallback(() => {
    if (
      signerCredentials != null &&
      giftTakerRootSnapshot?.matches("claiming")
    ) {
      giftTakerClaimRef?.send({
        type: "CONFIRM_CLAIM",
        params: {
          giftInfo,
          signerCredentials,
        },
      })
    }
  }, [signerCredentials, giftTakerRootSnapshot, giftTakerClaimRef, giftInfo])

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
      {snapshot?.matches("claimed") && (
        <div className="flex justify-center mt-5">Gift claimed!</div>
      )}

      <ButtonCustom
        onClick={claimGift}
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
