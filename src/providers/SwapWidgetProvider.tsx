import type React from "react"
import type { PropsWithChildren } from "react"

import { Modal } from "../components/Modal"

import { ModalStoreProvider } from "./ModalStoreProvider"
import { TokensStoreProvider } from "./TokensStoreProvider"

export const SwapWidgetProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  return (
    <ModalStoreProvider>
      <TokensStoreProvider>
        {children}
        <Modal />
      </TokensStoreProvider>
    </ModalStoreProvider>
  )
}
