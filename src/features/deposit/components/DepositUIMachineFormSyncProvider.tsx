import { type PropsWithChildren, useEffect } from "react"
import { useFormContext } from "react-hook-form"
import type { ChainType } from "../../../types"
import type { DepositFormValues } from "./DepositForm"
import { DepositUIMachineContext } from "./DepositUIMachineProvider"

type DepositUIMachineFormSyncProviderProps = PropsWithChildren<{
  userAddress?: string
  userChainType?: ChainType
}>

export function DepositUIMachineFormSyncProvider({
  children,
  userAddress,
  userChainType,
}: DepositUIMachineFormSyncProviderProps) {
  const { watch } = useFormContext<DepositFormValues>()
  const actorRef = DepositUIMachineContext.useActorRef()

  useEffect(() => {
    const sub = watch(async (value, { name }) => {
      if (name === "network" || name === "amount") {
        actorRef.send({
          type: "INPUT",
          params: { [name]: value[name] },
        })
      }
    })
    return () => {
      sub.unsubscribe()
    }
  }, [watch, actorRef])

  useEffect(() => {
    if (!userAddress || userChainType == null) {
      actorRef.send({
        type: "LOGOUT",
      })
    } else {
      actorRef.send({
        type: "LOGIN",
        params: { userAddress, userChainType },
      })
    }
  }, [actorRef, userAddress, userChainType])

  return <>{children}</>
}
