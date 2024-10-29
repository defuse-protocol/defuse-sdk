import { Button } from "@radix-ui/themes"
import { useModalStore } from "../../providers/ModalStoreProvider"
import { ModalDialog } from "./ModalDialog"

export type ModalConfirmAddPubkeyPayload = {
  accountId: string
  onConfirm: () => void
  onAbort: () => void
}

export const ModalConfirmAddPubkey = () => {
  const { onCloseModal, payload } = useModalStore((state) => state)
  const { accountId, onConfirm, onAbort } =
    payload as ModalConfirmAddPubkeyPayload

  return (
    <ModalDialog
      onClose={() => {
        onAbort()
      }}
    >
      Is it you {accountId}?
      <Button
        onClick={() => {
          onConfirm()
        }}
      >
        Confirm
      </Button>
      <Button
        onClick={() => {
          // `onCloseModal` does not call `onClose` prop passed to `ModalDialog`, so we need to call abort manually
          onAbort()
          onCloseModal()
        }}
      >
        Cancel
      </Button>
    </ModalDialog>
  )
}
