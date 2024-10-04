import React from "react"

import { SwapWidgetProvider } from "../../../providers"
import { useModalStore } from "../../../providers/ModalStoreProvider"
import { ModalType } from "../../../stores/modalStore"
import type { SwapWidgetProps } from "../../../types"
import type { BaseTokenInfo } from "../../../types/base"

import { type OnSubmitValues, SwapForm } from "./SwapForm"

export const SwapWidget = ({ tokenList, onSign }: SwapWidgetProps) => {
  const { setModalType, payload, onCloseModal } = useModalStore(
    (state) => state
  )

  const handleSubmit = (values: OnSubmitValues) => {
    console.log(values)
  }

  const handleSelect = (fieldName: string, selectToken: BaseTokenInfo) => {
    setModalType(ModalType.MODAL_SELECT_ASSETS, { fieldName, selectToken })
  }
  return (
    <SwapWidgetProvider>
      <SwapForm
        selectTokenIn={tokenList[0]!}
        selectTokenOut={tokenList[1]!}
        onSubmit={handleSubmit}
        onSelect={handleSelect}
        isFetching={false}
      />
    </SwapWidgetProvider>
  )
}
