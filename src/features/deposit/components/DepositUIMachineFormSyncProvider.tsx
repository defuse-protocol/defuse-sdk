import { type PropsWithChildren, useEffect } from "react"
import { useFormContext } from "react-hook-form"
import type { BlockchainEnum } from "../../../types"
import type { DepositFormValues } from "./DepositForm"
import { DepositUIMachineContext } from "./DepositUIMachineProvider"

type DepositUIMachineFormSyncProviderProps = PropsWithChildren<{
  userAddress?: string
}>

export function DepositUIMachineFormSyncProvider({
  children,
  userAddress,
}: DepositUIMachineFormSyncProviderProps) {
  const { watch } = useFormContext<DepositFormValues>()
  const actorRef = DepositUIMachineContext.useActorRef()

  useEffect(() => {
    const sub = watch(async (value, { name }) => {
      if (name === "network") {
        actorRef.send({
          type: "INPUT",
          params: { [name]: value[name] },
        })
      }
      if (name === "amount") {
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
    if (!userAddress) {
      actorRef.send({
        type: "LOGOUT",
      })
    } else {
      actorRef.send({
        type: "LOGIN",
        params: { userAddress },
      })
    }
  }, [actorRef, userAddress])

  return <>{children}</>
}
