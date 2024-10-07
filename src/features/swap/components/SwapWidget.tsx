import React, { useEffect } from "react"

import { SwapWidgetProvider } from "../../../providers"
import { useModalStore } from "../../../providers/ModalStoreProvider"
import { ModalType } from "../../../stores/modalStore"
import type { SwapMessageParams, SwapWidgetProps } from "../../../types"
import type { BaseTokenInfo } from "../../../types/base"

import { useTokensStore } from "../../../providers/TokensStoreProvider"
import { type OnSubmitValues, SwapForm } from "./SwapForm"

export const SwapWidget = ({ tokenList, onSign }: SwapWidgetProps) => {
  const { updateTokens } = useTokensStore((state) => state)

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

  return (
    <SwapWidgetProvider>
      <SwapForm
        // biome-ignore lint/style/noNonNullAssertion: tokenList is asserted to have at least 2 tokens
        selectTokenIn={tokenList[0]!}
        // biome-ignore lint/style/noNonNullAssertion: tokenList is asserted to have at least 2 tokens
        selectTokenOut={tokenList[1]!}
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
