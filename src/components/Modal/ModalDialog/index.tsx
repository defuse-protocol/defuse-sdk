import { Dialog, VisuallyHidden } from "@radix-ui/themes"
import {
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { useResize } from "../../../hooks/useResize"
import { useModalStore } from "../../../providers/ModalStoreProvider"
import { WidgetContext } from "../../WidgetRoot"

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

  const { portalContainer } = useContext(WidgetContext)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Content
        container={portalContainer}
        className={`fixed bg-white dark:bg-black-800 shadow-lg p-0 focus:outline-none
          md:w-[90vw] md:max-w-[512px] md:max-h-[85vh] md:p-6 md:top-1/2 md:bottom-auto md:left-1/2 md:right-auto md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:animate-content-show
          bottom-0 left-0 right-0 top-auto max-w-full max-h-[70vh] rounded-t-2xl animate-slide-up`}
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
