import type { PropsWithChildren } from "react"
import { ModalContainer } from "src/components/Modal/ModalContainer"
import { ModalStoreProvider } from "./ModalStoreProvider"
import { QueryClientProvider } from "./QueryClientProvider"

export const WithdrawWidgetProvider: React.FC<PropsWithChildren> = ({
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
