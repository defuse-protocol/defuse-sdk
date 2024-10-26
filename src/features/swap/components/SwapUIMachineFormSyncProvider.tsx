import { type PropsWithChildren, useEffect, useRef } from "react"
import { useFormContext } from "react-hook-form"
import type { SwapWidgetProps } from "../../../types"
import type { SwapFormValues } from "./SwapForm"
import { SwapUIMachineContext } from "./SwapUIMachineProvider"

type SwapUIMachineFormSyncProviderProps = PropsWithChildren<{
  userAddress: string | null
  onSuccessSwap: SwapWidgetProps["onSuccessSwap"]
}>

export function SwapUIMachineFormSyncProvider({
  children,
  userAddress,
  onSuccessSwap,
}: SwapUIMachineFormSyncProviderProps) {
  const { watch } = useFormContext<SwapFormValues>()
  const actorRef = SwapUIMachineContext.useActorRef()

  // Make `onSuccessSwap` stable reference, waiting for `useEvent` hook to come out
  const onSuccessSwapRef = useRef(onSuccessSwap)
  onSuccessSwapRef.current = onSuccessSwap

  useEffect(() => {
    // When values are set externally, they trigger "watch" callback too.
    // In order to avoid, unnecessary state updates need to check if the form is changed by user
    const sub = watch(async (value, { type, name }) => {
      if (type === "change" && name != null) {
        if (name === "amountIn") {
          actorRef.send({
            type: "input",
            params: { [name]: value[name] },
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
      actorRef.send({ type: "LOGOUT" })
    } else {
      actorRef.send({ type: "LOGIN", params: { accountId: userAddress } })
    }
  }, [actorRef, userAddress])

  useEffect(() => {
    const sub = actorRef.on("INTENT_SETTLED", ({ data }) => {
      onSuccessSwapRef.current({
        amountIn: data.quote.totalAmountIn,
        amountOut: data.quote.totalAmountOut,
        tokenIn: data.tokenIn,
        tokenOut: data.tokenOut,
        txHash: data.txHash,
        intentHash: data.intentHash,
      })
    })

    return () => {
      sub.unsubscribe()
    }
  }, [actorRef])

  return <>{children}</>
}
