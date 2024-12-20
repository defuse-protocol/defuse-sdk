import { DialogOverlay } from "@radix-ui/react-dialog"
import { Dialog, VisuallyHidden } from "@radix-ui/themes"
import React, {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { useResize } from "../../../hooks/useResize"
import { useModalStore } from "../../../providers/ModalStoreProvider"
import styles from "./styles.module.css"

export const ModalDialog = ({
  children,
  onClose,
}: PropsWithChildren<{
  onClose?: () => void
}>) => {
  const { onCloseModal } = useModalStore((state) => state)
  const [open, setOpen] = useState(true)
  const [containerWidth, setContainerWidth] = useState<number>(0)
  const divRef = useRef<HTMLDivElement>(null)
  const { width } = useResize(divRef)

  const defaultMaxWidth = "512px"

  const handleCloseModal = useCallback(() => {
    if (!open) {
      onCloseModal()
      onClose?.()
    }
  }, [open, onCloseModal, onClose])

  useEffect(() => {
    handleCloseModal()
  }, [handleCloseModal])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `divRef.current` will be fixed soon
  useEffect(() => {
    if (divRef.current) {
      setContainerWidth(divRef.current.offsetWidth || 0)
    }
    return () => {
      setContainerWidth(0)
    }
  }, [divRef.current, width])

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <DialogOverlay className={styles.DialogOverlay} />
      <Dialog.Content
        className={`${styles.DialogContent} p-0 dark:bg-black-800`}
        maxWidth={
          containerWidth
            ? containerWidth < 768
              ? "100%"
              : defaultMaxWidth
            : defaultMaxWidth
        }
        onOpenAutoFocus={(e) => {
          // This is a workaround for focusing the first input in the modal
          // Focusing first input is annoying for mobile users
          e.preventDefault()
        }}
        // Suppressing the warning about missing aria-describedby
        aria-describedby={undefined}
      >
        <VisuallyHidden>
          <Dialog.Title>null</Dialog.Title>
        </VisuallyHidden>
        <div ref={divRef}>{children}</div>
      </Dialog.Content>
    </Dialog.Root>
  )
}
