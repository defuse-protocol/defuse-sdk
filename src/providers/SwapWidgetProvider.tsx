import React, { PropsWithChildren } from "react"

import { Modal } from "../components/Modal"

import { ModalStoreProvider } from "./ModalStoreProvider"
import { TokensStoreProvider } from "./TokensStoreProvider"

export const SwapWidgetProvider = ({ children }: PropsWithChildren) => {
  return (
    <ModalStoreProvider>
      <TokensStoreProvider>
        {children}
        <Modal />
      </TokensStoreProvider>
    </ModalStoreProvider>
  )
}
