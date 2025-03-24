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
import { GiftDescription } from "./shared/GiftDescription"
import { GiftHeader } from "./shared/GiftHeader"

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
      <GiftHeader title="You've received a gift!">
        <GiftDescription description="Sign in to claim it, no hidden fees or strings attached." />
      </GiftHeader>

      {/* Image Section */}
      <ShareableGiftImage
        token={giftInfo.token}
        amount={amount}
        message={
          giftInfo.message.length > 0
            ? giftInfo.message
            : "You've received a gift! Click to claim it."
        }
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
        variant={
          processing || signerCredentials === null ? "secondary" : "primary"
        }
        isLoading={processing}
        disabled={signerCredentials === null}
      >
        {signerCredentials !== null
          ? processing
            ? "Processing..."
            : "Claim gift"
          : "Sign in to claim gift"}
      </ButtonCustom>
    </div>
  )
}
