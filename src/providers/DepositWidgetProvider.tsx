import type React from "react"
import type { PropsWithChildren } from "react"

import { ModalContainer } from "../components/Modal/ModalContainer"

import { ModalStoreProvider } from "./ModalStoreProvider"

export const DepositWidgetProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  return (
    <ModalStoreProvider>
      {children}
      <ModalContainer />
    </ModalStoreProvider>
  )
}
