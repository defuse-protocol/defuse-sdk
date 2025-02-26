import { X as CrossIcon } from "@phosphor-icons/react"
import * as Dialog from "@radix-ui/react-dialog"
import { Theme } from "@radix-ui/themes"
import clsx from "clsx"
import {
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import { useModalStore } from "../../../providers/ModalStoreProvider"
import { WidgetContext } from "../../WidgetRoot"

export const ModalDialog = ({
  children,
  onClose,
  isDismissable,
}: PropsWithChildren<{
  onClose?: () => void
  isDismissable?: boolean
}>) => {
  const { onCloseModal } = useModalStore((state) => state)
  const [open, setOpen] = useState(true)

  const handleCloseModal = useCallback(() => {
    if (!open) {
      onCloseModal()
      onClose?.()
    }
  }, [open, onCloseModal, onClose])

  useEffect(() => {
    handleCloseModal()
  }, [handleCloseModal])

  return (
    <BaseModalDialog
      open={open}
      onClose={() => {
        setOpen(false)
        handleCloseModal()
      }}
      isDismissable={isDismissable}
    >
      {children}
    </BaseModalDialog>
  )
}

export function BaseModalDialog({
  open,
  children,
  onClose,
  isDismissable,
}: PropsWithChildren<{
  open: boolean
  onClose?: () => void
  isDismissable?: boolean
}>) {
  const { portalContainer } = useContext(WidgetContext)

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          onClose?.()
        }
      }}
    >
      <Dialog.Portal container={portalContainer}>
        <Theme asChild>
          <Dialog.Overlay
            className={clsx(
              "fixed inset-0 z-50 bg-gray-a8",
              // Backdrop animation forces the dialog to animate
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            )}
          >
            <div className="flex absolute inset-0 overflow-auto">
              <div className="m-auto">
                <Dialog.Content
                  className={clsx(
                    "relative overflow-auto",
                    "bg-white dark:bg-black-800 shadow-lg focus:outline-none",
                    "rounded-t-2xl md:rounded-2xl",
                    "max-w-full md:w-[90vw] md:max-w-[472px] max-h-[70vh] md:max-h-[85vh]",
                    "px-5 pt-5 pb-[max(env(safe-area-inset-bottom,0px),theme(spacing.5))] md:p-5",

                    // Re-position on smaller screens
                    "max-md:absolute max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:top-auto",

                    // Animation
                    "data-[state=open]:animate-in data-[state=closed]:animate-out",
                    "data-[state=open]:duration-300 data-[state=closed]:duration-200",
                    "data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full",
                    "md:data-[state=open]:slide-in-from-top-4 md:data-[state=closed]:slide-out-to-bottom-4",
                    "md:data-[state=open]:zoom-in-95 md:data-[state=closed]:zoom-out-95",
                    "md:data-[state=open]:fade-in md:data-[state=closed]:fade-out"
                  )}
                  onOpenAutoFocus={(e) => {
                    // This is a workaround for focusing the first input in the modal
                    // Focusing first input is annoying for mobile users
                    e.preventDefault()
                  }}
                  // Suppressing the warning about missing aria-describedby
                  aria-describedby={undefined}
                >
                  <Dialog.Title />

                  {isDismissable && (
                    <Dialog.Close className="flex items-center justify-center absolute top-5 right-5 size-10 rounded-full hover:bg-gray-3 active:bg-gray-4">
                      <CrossIcon weight="bold" className="size-5" />
                    </Dialog.Close>
                  )}

                  <div>{children}</div>
                </Dialog.Content>
              </div>
            </div>
          </Dialog.Overlay>
        </Theme>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
