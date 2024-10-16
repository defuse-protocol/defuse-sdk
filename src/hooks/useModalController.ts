import { useEffect, useState } from "react"
import { useModalStore } from "../providers/ModalStoreProvider"
import type { ModalType } from "../stores/modalStore"

export const useModalController = <T extends { modalType: ModalType }>(
  modalType: ModalType,
  keyController: string
) => {
  const { setModalType, payload, onCloseModal } = useModalStore(
    (state) => state
  )
  const [data, setData] = useState<T | undefined>(undefined)

  useEffect(() => {
    if (!payload || typeof payload !== "object" || !("modalType" in payload)) {
      return
    }
    if (payload.modalType !== modalType) {
      return
    }
    const { modalType: payloadModalType, ...rest } = payload as T
    const retrieveKey = rest[keyController as keyof typeof rest]
    if (payloadModalType === modalType && retrieveKey) {
      setData(payload as T)
      onCloseModal(undefined)
    }
  }, [payload, keyController, onCloseModal, modalType])

  return {
    setModalType,
    data,
  }
}
