import { providers } from "near-api-js"
import { type ReactNode, createContext } from "react"
import { logger } from "../../../logger"
import type { ChainType } from "../../../types/deposit"
import { SwapUIMachineContext } from "./SwapUIMachineProvider"

export const SwapSubmitterContext = createContext<{
  onSubmit: () => void
}>({
  onSubmit: () => {},
})

export function SwapSubmitterProvider({
  children,
  userAddress,
  userChainType,
}: {
  children: ReactNode
  userAddress: string | null
  userChainType: ChainType | null
}) {
  const actorRef = SwapUIMachineContext.useActorRef()

  const onSubmit = () => {
    if (userAddress == null || userChainType == null) {
      logger.warn("No user address provided")
      return
    }

    actorRef.send({
      type: "submit",
      params: {
        userAddress,
        userChainType,
        nearClient: new providers.JsonRpcProvider({
          url: "https://rpc.mainnet.near.org",
        }),
      },
    })
  }

  return (
    <SwapSubmitterContext.Provider value={{ onSubmit }}>
      {children}
    </SwapSubmitterContext.Provider>
  )
}
