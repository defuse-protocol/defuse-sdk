import { Check as CheckIcon, Copy as CopyIcon } from "@phosphor-icons/react"
import { Button, Dialog, Spinner } from "@radix-ui/themes"
import { useSelector } from "@xstate/react"
import { useCallback } from "react"
import type { SignerCredentials } from "src/core/formatters"
import type { ActorRefFrom } from "xstate"
import { ButtonCustom } from "../../../components/Button/ButtonCustom"
import { Copy } from "../../../components/IntentCard/CopyButton"
import { BaseModalDialog } from "../../../components/Modal/ModalDialog"
import type { giftMakerReadyActor } from "../actors/giftMakerReadyActor"
import type { GiftInfo } from "../actors/shared/getGiftInfo"
import type { giftClaimActor } from "../actors/shared/giftClaimActor"
import type { GiftPayload } from "../types/sharedTypes"
import { ShareableGiftImage } from "./ShareableGiftImage"
import { ErrorReason } from "./shared/ErrorReason"

type GiftMakerReadyDialogProps = {
  readyGiftRef: ActorRefFrom<typeof giftMakerReadyActor>
  generateLink: (giftPayload: GiftPayload) => string
  signerCredentials: SignerCredentials
}

export function GiftMakerReadyDialog({
  readyGiftRef,
  generateLink,
  signerCredentials,
}: GiftMakerReadyDialogProps) {
  const { giftCancellationRef, giftInfo } = useSelector(
    readyGiftRef,
    (state) => ({
      giftCancellationRef: state.children.giftMakerClaimRef as
        | undefined
        | ActorRefFrom<typeof giftClaimActor>,
      giftInfo: state.context.giftInfo,
    })
  )
  return (
    <>
      <GiftMakerDialog
        readyGiftRef={readyGiftRef}
        generateLink={generateLink}
      />
      <CancellationDialog
        giftInfo={giftInfo}
        actorRef={giftCancellationRef}
        signerCredentials={signerCredentials}
      />
    </>
  )
}

function GiftMakerDialog({
  readyGiftRef,
  generateLink,
}: {
  readyGiftRef: ActorRefFrom<typeof giftMakerReadyActor>
  generateLink: (giftPayload: GiftPayload) => string
}) {
  const { context } = useSelector(readyGiftRef, (state) => ({
    context: state.context,
  }))

  const finish = useCallback(() => {
    readyGiftRef.send({ type: "FINISH" })
  }, [readyGiftRef])

  const cancelGift = useCallback(() => {
    readyGiftRef.send({ type: "CANCEL_GIFT" })
  }, [readyGiftRef])

  const copyGiftLink = useCallback(() => {
    return generateLink({
      secretKey: context.escrowCredentials.secretKey,
      message: context.parsed.message,
    })
  }, [
    generateLink,
    context.escrowCredentials.secretKey,
    context.parsed.message,
  ])

  return (
    <BaseModalDialog open onClose={finish} isDismissable>
      {/* Header Section */}
      <div className="flex flex-col items-center text-center mb-6">
        <Dialog.Title className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-2">
          Share your gift
        </Dialog.Title>
        <Dialog.Description className="text-sm font-medium text-gray-11 dark:text-gray-400">
          Your funds are on-chain. The recipient can claim them via the link, or
          you can reclaim them if needed.
        </Dialog.Description>
      </div>

      {/* Image Section */}
      <ShareableGiftImage
        token={context.parsed.token}
        amount={context.parsed.amount}
        message={
          context.parsed.message.length > 0
            ? context.parsed.message
            : "Enjoy your gift!"
        }
      />

      <div className="flex flex-col justify-center gap-3 mt-5">
        <Copy text={copyGiftLink()}>
          {(copied) => (
            <ButtonCustom
              type="button"
              size="lg"
              variant="primary"
              variantRadix={copied ? "soft" : undefined}
            >
              <div className="flex gap-2 items-center">
                {copied ? (
                  <CheckIcon weight="bold" />
                ) : (
                  <CopyIcon weight="bold" />
                )}
                {copied ? "Copied" : "Copy link"}
              </div>
            </ButtonCustom>
          )}
        </Copy>

        <ButtonCustom
          size="lg"
          type="button"
          variant="danger"
          onClick={cancelGift}
        >
          Cancel gift
        </ButtonCustom>
      </div>
    </BaseModalDialog>
  )
}

interface CancellationDialogProps {
  actorRef: ActorRefFrom<typeof giftClaimActor> | undefined | null
  giftInfo: GiftInfo
  signerCredentials: SignerCredentials
}

function CancellationDialog({
  actorRef,
  giftInfo,
  signerCredentials,
}: CancellationDialogProps) {
  const snapshot = useSelector(actorRef ?? undefined, (state) => state)

  const abortCancellation = useCallback(() => {
    actorRef?.send({ type: "ABORT_CLAIM" })
  }, [actorRef])

  const ackCancellationImpossible = useCallback(() => {
    actorRef?.send({ type: "ACK_CLAIM_IMPOSSIBLE" })
  }, [actorRef])

  const confirmCancellation = useCallback(() => {
    actorRef?.send({
      type: "CONFIRM_CLAIM",
      params: { giftInfo, signerCredentials },
    })
  }, [actorRef, giftInfo, signerCredentials])

  return (
    <BaseModalDialog
      open={!!actorRef}
      onClose={abortCancellation}
      isDismissable
    >
      {snapshot?.matches("idleUnclaimable") ? (
        <>
          <div>This gift is either already cancelled or executed.</div>

          <Button type="button" onClick={ackCancellationImpossible}>
            Ok
          </Button>
        </>
      ) : (
        <>
          <Dialog.Title className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-2">
            Cancel gift?
          </Dialog.Title>
          <Dialog.Description className="text-sm font-medium text-gray-600 dark:text-gray-400">
            The funds will return to your account, and the link will no longer
            work.
          </Dialog.Description>

          {snapshot?.context.error != null &&
            typeof snapshot.context.error?.reason === "string" && (
              <ErrorReason reason={snapshot.context.error?.reason} />
            )}

          <div className="flex flex-col md:flex-row justify-center gap-3 mt-5">
            <Button
              type="button"
              size="4"
              variant="outline"
              color="gray"
              className="md:flex-1 font-bold"
              onClick={abortCancellation}
            >
              Keep
            </Button>

            <Button
              type="button"
              size="4"
              variant="solid"
              color="red"
              className="md:flex-1 font-bold"
              onClick={confirmCancellation}
            >
              <Spinner loading={!!snapshot?.matches("claiming")} />
              {snapshot?.matches("claiming") ? "Cancelling..." : "Cancel gift"}
            </Button>
          </div>
        </>
      )}
    </BaseModalDialog>
  )
}
