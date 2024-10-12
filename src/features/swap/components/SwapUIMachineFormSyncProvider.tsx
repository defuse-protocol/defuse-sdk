import { type PropsWithChildren, useEffect } from "react"
import { useFormContext } from "react-hook-form"
import type { SwapFormValues } from "./SwapForm"
import { SwapUIMachineContext } from "./SwapUIMachineProvider"

export function SwapUIMachineFormSyncProvider({ children }: PropsWithChildren) {
  const { watch } = useFormContext<SwapFormValues>()
  const actorRef = SwapUIMachineContext.useActorRef()

  useEffect(() => {
    // When values are set externally, they trigger "watch" callback too.
    // In order to avoid, unnecessary state updates need to check if the form is changed by user
    const sub = watch(async (_, { type, name }) => {
      if (type === "change" && name != null) {
        actorRef.send({ type: "input" })
      }
    })
    return () => {
      sub.unsubscribe()
    }
  }, [watch, actorRef])

  return <>{children}</>
}
