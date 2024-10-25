import { type PropsWithChildren, useEffect, useRef } from "react"
import { useFormContext } from "react-hook-form"
import type { SwapWidgetProps } from "../../../types"
import type { SwapFormValues } from "./SwapForm"
import { SwapUIMachineContext } from "./SwapUIMachineProvider"

type SwapUIMachineFormSyncProviderProps = PropsWithChildren<{
  onSuccessSwap: SwapWidgetProps["onSuccessSwap"]
}>

export function SwapUIMachineFormSyncProvider({
  children,
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
