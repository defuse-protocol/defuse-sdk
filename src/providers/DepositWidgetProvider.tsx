import type React from "react"
import type { PropsWithChildren } from "react"

import { ModalContainer } from "../components/Modal/ModalContainer"

import { ModalStoreProvider } from "./ModalStoreProvider"
import { RootProvider } from "./RootProvider"

export const DepositWidgetProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  return (
    <RootProvider>
      <ModalStoreProvider>
        {children}
        <ModalContainer />
      </ModalStoreProvider>
    </RootProvider>
  )
}
