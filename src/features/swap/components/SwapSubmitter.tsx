import { providers } from "near-api-js"
import { type ReactNode, createContext } from "react"
import type { SendNearTransaction } from "../../machines/publicKeyVerifierMachine"
import { SwapUIMachineContext } from "./SwapUIMachineProvider"

export const SwapSubmitterContext = createContext<{
  onSubmit: () => void
}>({
  onSubmit: () => {},
})

export function SwapSubmitterProvider({
  children,
  userAddress,
  sendNearTransaction,
}: {
  children: ReactNode
  userAddress: string | null
  sendNearTransaction: SendNearTransaction
}) {
  const actorRef = SwapUIMachineContext.useActorRef()

  const onSubmit = () => {
    if (userAddress == null) {
      console.warn("No user address provided")
      return
    }

    actorRef.send({
      type: "submit",
      params: {
        userAddress,
        nearClient: new providers.JsonRpcProvider({
          url: "https://rpc.mainnet.near.org",
        }),
        sendNearTransaction,
      },
    })
  }

  return (
    <SwapSubmitterContext.Provider value={{ onSubmit }}>
      {children}
    </SwapSubmitterContext.Provider>
  )
}
