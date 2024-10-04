import { useEffect } from "react"

import { useModalStore } from "../providers/ModalStoreProvider"
import { ModalType } from "../stores/modalStore"

export const useModalSearchParams = () => {
  const { setModalType } = useModalStore((state) => state)

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const modalType = searchParams.get("modalType") as string | null

    if (
      modalType &&
      Object.values(ModalType).includes(modalType as ModalType)
    ) {
      setModalType(modalType as ModalType)
    }
  }, [setModalType])
}
