import React from "react"

import { SwapWidgetProvider } from "src/providers"
import { useModalStore } from "src/providers/ModalStoreProvider"
import { ModalType } from "src/stores/modalStore"
import { BaseTokenInfo } from "src/types/base"

import { SwapWidgetProps } from "../../../types"

import { OnSubmitValues, SwapForm } from "./SwapForm"

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
