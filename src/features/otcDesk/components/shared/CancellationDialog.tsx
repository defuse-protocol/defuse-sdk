import { Button, Dialog, Spinner } from "@radix-ui/themes"
import { useSelector } from "@xstate/react"
import type { ActorRefFrom } from "xstate"
import { ModalDialog } from "../../../../components/Modal/ModalDialog"
import type { SignerCredentials } from "../../../../core/formatters"
import type { otcMakerOrderCancellationActor } from "../../actors/otcMakerOrderCancellationActor"
import type { SignMessage } from "../../types/sharedTypes"

interface CancellationDialogProps {
  actorRef: ActorRefFrom<typeof otcMakerOrderCancellationActor>
  signerCredentials: SignerCredentials
  signMessage: SignMessage
}

export function CancellationDialog({
  actorRef,
  signerCredentials,
  signMessage,
}: CancellationDialogProps) {
  const snapshot = useSelector(actorRef, (state) => state)

  return (
    <ModalDialog onClose={() => actorRef.send({ type: "ABORT_CANCELLATION" })}>
      {snapshot.matches("idleUncancellable") ? (
        <>
          <div>This order is either already cancelled or executed.</div>

          <Button
            type="button"
            onClick={() => {
              actorRef.send({ type: "ACK_CANCELLATION_IMPOSSIBLE" })
            }}
          >
            Ok
          </Button>
        </>
      ) : (
        <>
          <Dialog.Title className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-2">
            Cancel order?
          </Dialog.Title>
          <Dialog.Description className="text-sm font-medium text-gray-600 dark:text-gray-400">
            The funds will stay safely in your wallet, and the link will no
            longer work.
          </Dialog.Description>

          {snapshot.context.error != null && (
            <div className="text-red-700">{snapshot.context.error?.reason}</div>
          )}

          <div className="flex flex-col md:flex-row justify-center gap-3 mt-5">
            <Button
              type="button"
              size="4"
              variant="outline"
              className="flex-1 font-bold"
              onClick={() => actorRef.send({ type: "ABORT_CANCELLATION" })}
            >
              Keep
            </Button>

            <Button
              type="button"
              size="4"
              variant="solid"
              className="flex-1 font-bold"
              onClick={() =>
                actorRef.send({
                  type: "CONFIRM_CANCELLATION",
                  signerCredentials,
                  signMessage,
                })
              }
            >
              <Spinner loading={snapshot.matches("cancelling")} />
              {snapshot.matches("cancelling")
                ? "Cancelling..."
                : "Cancel order"}
            </Button>
          </div>
        </>
      )}
    </ModalDialog>
  )
}
