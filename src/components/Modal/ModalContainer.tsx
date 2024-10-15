import React from "react"

import { useModalStore } from "../../providers/ModalStoreProvider"

import { ModalType } from "../../stores/modalStore"

import { ModalDepositSelectAssets } from "./ModalDepositSelectAssets"
import { ModalSelectAssets } from "./ModalSelectAssets"

export const ModalContainer = () => {
  const { modalType } = useModalStore((state) => state)

  switch (modalType) {
    case ModalType.MODAL_SELECT_ASSETS:
      return <ModalSelectAssets />
    case ModalType.MODAL_DEPOSIT_SELECT_ASSETS:
      return <ModalDepositSelectAssets />
    default:
      return null
  }
}
