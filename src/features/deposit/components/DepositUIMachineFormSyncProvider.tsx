import { type PropsWithChildren, useEffect } from "react"
import { useFormContext } from "react-hook-form"
import type { DepositBlockchainEnum } from "../../../types/deposit"
import type { DepositFormValues } from "./DepositForm"
import { DepositUIMachineContext } from "./DepositUIMachineProvider"

type DepositUIMachineFormSyncProviderProps = PropsWithChildren<{
  userAddress: string | null
}>

export function DepositUIMachineFormSyncProvider({
  children,
  userAddress,
}: DepositUIMachineFormSyncProviderProps) {
  const { watch } = useFormContext<DepositFormValues>()
  const actorRef = DepositUIMachineContext.useActorRef()

  useEffect(() => {
    const sub = watch(async (value, { type, name }) => {
      if (name === "network") {
        actorRef.send({
          type: "INPUT",
          params: { [name]: value[name] as DepositBlockchainEnum },
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
    if (userAddress == null) {
      actorRef.send({ type: "LOGIN", params: { userAddress: "" } })
    } else {
      actorRef.send({ type: "LOGIN", params: { userAddress } })
    }
  }, [actorRef, userAddress])

  return <>{children}</>
}
