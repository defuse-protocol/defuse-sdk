import type { PropsWithChildren } from "react"
import { ModalContainer } from "src/components/Modal/ModalContainer"
import { ModalStoreProvider } from "./ModalStoreProvider"
import { RootProvider } from "./RootProvider"

export const WithdrawWidgetProvider: React.FC<PropsWithChildren> = ({
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
