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
      if (name === "network") {
        const networkValue = value[name]
        // TODO: For some reason, the form sets the network to an empty string when the network is reset
        if (!!networkValue && networkValue.length === 0) {
          return
        }
        actorRef.send({
          type: "DEPOSIT_FORM.UPDATE_BLOCKCHAIN",
          params: { network: value[name] },
        })
      }
      if (name === "amount") {
        actorRef.send({
          type: "DEPOSIT_FORM.UPDATE_AMOUNT",
          params: { amount: value[name] },
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
