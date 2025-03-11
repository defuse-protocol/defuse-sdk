import { Check as CheckIcon, Copy as CopyIcon } from "@phosphor-icons/react"
import { Button, Dialog, Spinner } from "@radix-ui/themes"
import { useSelector } from "@xstate/react"
import type { ActorRefFrom } from "xstate"
import { ButtonCustom } from "../../../components/Button/ButtonCustom"
import { Copy } from "../../../components/IntentCard/CopyButton"
import { BaseModalDialog } from "../../../components/Modal/ModalDialog"
import type { SignerCredentials } from "../../../core/formatters"
import type { giftMakerCancellationActor } from "../actors/giftMakerCancellationActor"
import type { giftMakerReadyActor } from "../actors/giftMakerReadyActor"
import type { SignMessage } from "../types/sharedTypes"
import { ShareableGiftImage } from "./ShareableGiftImage"

type GiftMakerReadyDialogProps = {
  readyGiftRef: ActorRefFrom<typeof giftMakerReadyActor>
  signerCredentials: SignerCredentials
  signMessage: SignMessage
  generateLink: (secretKey: string) => string
}

export function GiftMakerReadyDialog({
  readyGiftRef,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  signerCredentials,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  signMessage,
  generateLink,
}: GiftMakerReadyDialogProps) {
  const { giftCancellationRef } = useSelector(readyGiftRef, (state) => ({
    giftCancellationRef: state.children.giftMakerCancellationRef as
      | undefined
      | ActorRefFrom<typeof giftMakerCancellationActor>,
  }))
  return (
    <>
      <GiftMakerDialog
        readyGiftRef={readyGiftRef}
        generateLink={generateLink}
      />
      <CancellationDialog actorRef={giftCancellationRef} />
    </>
  )
}

function GiftMakerDialog({
  readyGiftRef,
  generateLink,
}: {
  readyGiftRef: ActorRefFrom<typeof giftMakerReadyActor>
  generateLink: (secretKey: string) => string
}) {
  const { context } = useSelector(readyGiftRef, (state) => ({
    context: state.context,
  }))

  const finish = () => {
    readyGiftRef.send({ type: "FINISH" })
  }

  const cancelGift = () => {
    readyGiftRef.send({ type: "CANCEL_ORDER" })
  }

  return (
    <BaseModalDialog open={true} onClose={finish} isDismissable>
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
        token={context.parsed.tokenIn}
        amount={context.parsed.amount}
        message={
          context.parsed.message.length > 0
            ? context.parsed.message
            : "Enjoy your gift!"
        }
      />

      <div className="flex flex-col justify-center gap-3 mt-5">
        <Copy
          text={() => generateLink(context.escrowCredentials.NEP413.secretKey)}
        >
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
  actorRef: ActorRefFrom<typeof giftMakerCancellationActor> | undefined | null
}

function CancellationDialog({ actorRef }: CancellationDialogProps) {
  const snapshot = useSelector(actorRef ?? undefined, (state) => state)

  return (
    <BaseModalDialog
      open={!!actorRef}
      onClose={() => {
        actorRef?.send({ type: "ABORT_CANCELLATION" })
      }}
      isDismissable
    >
      {snapshot?.matches("idleUncancellable") ? (
        <>
          <div>This gift is either already cancelled or executed.</div>

          <Button
            type="button"
            onClick={() => {
              actorRef?.send({ type: "ACK_CANCELLATION_IMPOSSIBLE" })
            }}
          >
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

          {snapshot?.context.error != null && (
            <div className="text-red-700">
              {snapshot?.context.error?.reason}
            </div>
          )}

          <div className="flex flex-col md:flex-row justify-center gap-3 mt-5">
            <Button
              type="button"
              size="4"
              variant="outline"
              color="gray"
              className="md:flex-1 font-bold"
              onClick={() => actorRef?.send({ type: "ABORT_CANCELLATION" })}
            >
              Keep
            </Button>

            <Button
              type="button"
              size="4"
              variant="solid"
              color="red"
              className="md:flex-1 font-bold"
              onClick={() =>
                actorRef?.send({
                  type: "CONFIRM_CANCELLATION",
                })
              }
            >
              <Spinner loading={!!snapshot?.matches("cancelling")} />
              {snapshot?.matches("cancelling")
                ? "Cancelling..."
                : "Cancel gift"}
            </Button>
          </div>
        </>
      )}
    </BaseModalDialog>
  )
}
