import type React from "react"
import type { PropsWithChildren } from "react"

import { ModalContainer } from "../components/Modal/ModalContainer"

import { ModalStoreProvider } from "./ModalStoreProvider"
import { TokensStoreProvider } from "./TokensStoreProvider"
import "../styles/main.css"

export const SwapWidgetProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  return (
    <ModalStoreProvider>
      <TokensStoreProvider>
        {children}
        <ModalContainer />
      </TokensStoreProvider>
    </ModalStoreProvider>
  )
}
