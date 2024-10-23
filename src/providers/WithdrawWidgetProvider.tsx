import type { PropsWithChildren } from "react"
import { ModalContainer } from "src/components/Modal/ModalContainer"
import { ModalStoreProvider } from "./ModalStoreProvider"
import { TokensStoreProvider } from "./TokensStoreProvider"

export const WithdrawWidgetProvider: React.FC<PropsWithChildren> = ({
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
