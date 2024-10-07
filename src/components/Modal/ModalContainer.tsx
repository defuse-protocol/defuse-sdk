import React from "react"

import { useModalStore } from "../../providers/ModalStoreProvider"
// import ModalReviewSwap from "./ModalReviewSwap"
// import ModalConfirmSwap from "./ModalConfirmSwap"

import { ModalType } from "../../stores/modalStore"

import { ModalSelectAssets } from "./ModalSelectAssets"

export const ModalContainer = () => {
  const { modalType } = useModalStore((state) => state)

  switch (modalType) {
    case ModalType.MODAL_SELECT_ASSETS:
      return <ModalSelectAssets />
    // case ModalType.MODAL_REVIEW_SWAP:
    //   return <ModalReviewSwap />
    // case ModalType.MODAL_CONFIRM_SWAP:
    //   return <ModalConfirmSwap />
  }
}
