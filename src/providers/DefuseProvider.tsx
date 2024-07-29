import React, { PropsWithChildren } from "react"

import Modal from "../components/Modal"

import { TokensStoreProvider } from "./TokensStoreProvider"
import { ModalStoreProvider } from "./ModalStoreProvider"

const DefuseProvider = ({ children }: PropsWithChildren) => {
  return (
    <TokensStoreProvider>
      <ModalStoreProvider>
        {children}
        <Modal />
      </ModalStoreProvider>
    </TokensStoreProvider>
  )
}

export default DefuseProvider
