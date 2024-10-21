import { useEffect, useState } from "react"

import { SwapWidgetProvider } from "../../../providers"
import { useModalStore } from "../../../providers/ModalStoreProvider"
import { ModalType } from "../../../stores/modalStore"
import type { SwapWidgetProps, SwappableToken } from "../../../types"

import type { ModalSelectAssetsPayload } from "src/components/Modal/ModalSelectAssets"
import { useTokensStore } from "../../../providers/TokensStoreProvider"
import { SwapForm } from "./SwapForm"
import { SwapFormProvider } from "./SwapFormProvider"
import { SwapUIMachineFormSyncProvider } from "./SwapUIMachineFormSyncProvider"
import { SwapUIMachineProvider } from "./SwapUIMachineProvider"

export const SwapWidget = ({
  tokenList,
  userAddress,
  signMessage,
  onSuccessSwap,
}: SwapWidgetProps) => {
  const { updateTokens } = useTokensStore((state) => state)

  assert(tokenList.length > 2, "Token list must have at least 2 tokens")

  const [selectTokenIn, setSelectTokenIn] = useState<SwappableToken>(
    // biome-ignore lint/style/noNonNullAssertion: tokenList[0] is guaranteed to be defined
    tokenList[0]!
  )
  const [selectTokenOut, setSelectTokenOut] = useState<SwappableToken>(
    // biome-ignore lint/style/noNonNullAssertion: tokenList[1] is guaranteed to be defined
    tokenList[1]!
  )

  const { setModalType, payload, onCloseModal } = useModalStore(
    (state) => state
  )

  const handleSelect = (
    fieldName: string,
    selectToken: SwappableToken | undefined
  ) => {
    setModalType(ModalType.MODAL_SELECT_ASSETS, { fieldName, selectToken })
  }

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
  }, [payload, onCloseModal])

  const handleSwitch = async () => {
    const tempTokenInCopy = Object.assign({}, selectTokenIn)
    setSelectTokenIn(selectTokenOut)
    setSelectTokenOut(tempTokenInCopy)
  }

  return (
    <SwapWidgetProvider>
      <SwapFormProvider>
        <SwapUIMachineProvider
          assetIn={selectTokenIn}
          assetOut={selectTokenOut}
          signMessage={signMessage}
        >
          <SwapUIMachineFormSyncProvider onSuccessSwap={onSuccessSwap}>
            <SwapForm
              userAddress={userAddress}
              selectTokenIn={selectTokenIn}
              selectTokenOut={selectTokenOut}
              onSwitch={handleSwitch}
              onSelect={handleSelect}
              isFetching={false}
            />
          </SwapUIMachineFormSyncProvider>
        </SwapUIMachineProvider>
      </SwapFormProvider>
    </SwapWidgetProvider>
  )
}

function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}
