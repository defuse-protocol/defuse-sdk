import React, { useEffect, useState } from "react"

import { SwapWidgetProvider } from "../../../providers"
import { useModalStore } from "../../../providers/ModalStoreProvider"
import { ModalType } from "../../../stores/modalStore"
import type { SwapMessageParams, SwapWidgetProps } from "../../../types"
import type { BaseTokenInfo } from "../../../types/base"

import { useTokensStore } from "../../../providers/TokensStoreProvider"
import { type OnSubmitValues, SwapForm } from "./SwapForm"
import { ModalSelectAssetsPayload } from "src/components/Modal/ModalSelectAssets"

export const SwapWidget = ({ tokenList, onSign }: SwapWidgetProps) => {
  const { updateTokens } = 
  useTokensStore((state) => state)

  const [selectTokenIn, setSelectTokenIn] = useState<BaseTokenInfo | undefined>(tokenList[0])
  const [selectTokenOut, setSelectTokenOut] = useState<BaseTokenInfo | undefined>(tokenList[1])

  const { setModalType, payload, onCloseModal } = useModalStore(
    (state) => state
  )

  const handleSubmit = async (values: OnSubmitValues) => {
    // TODO Get message for sign from swapFacade
    const message: SwapMessageParams = {
      message: "",
      recipient: "",
      nonce: Buffer.from([]),
    }
    const signature = await onSign(message)
    console.log(signature)
  }

  const handleSelect = (fieldName: string, selectToken: BaseTokenInfo) => {
    setModalType(ModalType.MODAL_SELECT_ASSETS, { fieldName, selectToken })
  }

  assert(tokenList.length > 2, "Token list must have at least 2 tokens")

  useEffect(() => {
    if (tokenList) {
      updateTokens(tokenList)
    }
  }, [tokenList, updateTokens])

  useEffect(() => {
    if (
      (payload as ModalSelectAssetsPayload)?.modalType !==
      ModalType.MODAL_SELECT_ASSETS
    ) {
      return
    }
    const { modalType, fieldName, token } = payload as ModalSelectAssetsPayload
    if (modalType === ModalType.MODAL_SELECT_ASSETS && fieldName && token) {
      switch (fieldName) {
        case "tokenIn":
          setSelectTokenIn(token)
          break
        case "tokenOut":
          setSelectTokenOut(token)
          break
      }
      onCloseModal(undefined)
    }
  }, [payload, selectTokenIn, selectTokenOut])

  const handleSwitch = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    const tempTokenInCopy = Object.assign({}, selectTokenIn)
    setSelectTokenIn(selectTokenOut)
    setSelectTokenOut(tempTokenInCopy)
  }

  return (
    <SwapWidgetProvider>
      <SwapForm
        selectTokenIn={selectTokenIn!}
        selectTokenOut={selectTokenOut!}
        onSwitch={handleSwitch}
        onSubmit={handleSubmit}
        onSelect={handleSelect}
        isFetching={false}
      />
    </SwapWidgetProvider>
  )
}

function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}
