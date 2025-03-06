import { Check as CheckIcon, Copy as CopyIcon } from "@phosphor-icons/react"
import { Dialog } from "@radix-ui/themes"
import { useSelector } from "@xstate/react"
import type { ActorRefFrom } from "xstate"
import { ButtonCustom } from "../../../components/Button/ButtonCustom"
import { Copy } from "../../../components/IntentCard/CopyButton"
import { BaseModalDialog } from "../../../components/Modal/ModalDialog"
import type { SignerCredentials } from "../../../core/formatters"
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
  return (
    <>
      <GiftMakerDialog
        readyGiftRef={readyGiftRef}
        generateLink={generateLink}
      />
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

  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  const cancelOrder = () => {
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
        amountIn={context.parsed.amountIn}
        message={
          context.parsed.message.length > 0
            ? context.parsed.message
            : "Enjoy your gift!"
        }
      />

      <div className="flex flex-col justify-center gap-3 mt-5">
        <Copy text={() => generateLink(context.escrowKeyPair.secretKey)}>
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
      </div>
    </BaseModalDialog>
  )
}
