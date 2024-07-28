import React, { PropsWithChildren } from "react"

import { TokensStoreProvider } from "./TokensStoreProvider"

const RootProvider = ({ children }: PropsWithChildren) => {
  return <TokensStoreProvider>{children}</TokensStoreProvider>
}

export default RootProvider
