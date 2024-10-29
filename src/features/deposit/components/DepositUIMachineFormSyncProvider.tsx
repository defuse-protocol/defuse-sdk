import { type PropsWithChildren, useEffect, useRef } from "react"
import { useFormContext } from "react-hook-form"
import type { DepositBlockchainEnum } from "src/types"
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
    // When values are set externally, they trigger "watch" callback too.
    // In order to avoid, unnecessary state updates need to check if the form is changed by user
    const sub = watch(async (value, { type, name }) => {
      if (type === "change" && name != null) {
        if (name === "amount") {
          actorRef.send({
            type: "INPUT",
            params: { [name]: value[name] },
          })
        }
        if (name === "network") {
          actorRef.send({
            type: "INPUT",
            params: { [name]: value[name] as DepositBlockchainEnum },
          })
        }
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
