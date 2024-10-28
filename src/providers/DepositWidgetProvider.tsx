import type React from "react"
import type { PropsWithChildren } from "react"

import { ModalContainer } from "../components/Modal/ModalContainer"

import { ModalStoreProvider } from "./ModalStoreProvider"
import { QueryClientProvider } from "./QueryClientProvider"

export const DepositWidgetProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  return (
    <QueryClientProvider>
      <ModalStoreProvider>
        {children}
        <ModalContainer />
      </ModalStoreProvider>
    </QueryClientProvider>
  )
}
