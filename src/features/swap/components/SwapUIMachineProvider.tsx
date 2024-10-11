import { createActorContext } from "@xstate/react"
import type { PropsWithChildren } from "react"
import { useFormContext } from "react-hook-form"
import { fromPromise } from "xstate"
import { swapIntentMachine } from "../../machines/swapIntentMachine"
import { type QuoteTmp, swapUIMachine } from "../../machines/swapUIMachine"
import type { SwapFormValues } from "./SwapForm"

export const SwapUIMachineContext = createActorContext(swapUIMachine)

export function SwapUIMachineProvider({ children }: PropsWithChildren) {
  const { trigger } = useFormContext<SwapFormValues>()

  return (
    <SwapUIMachineContext.Provider
      logic={swapUIMachine.provide({
        delays: {
          quotePollingInterval: 5000, // temporary increase to 5 sec during development in order to reduce polluting the logs
        },
        actors: {
          formValidation: fromPromise(async () => {
            // We validate only `amountIn` and not entire form, because currently `amountOut` is also part of the form
            return trigger("amountIn")
          }),
          queryQuote: fromPromise(async (): Promise<QuoteTmp> => {
            console.log("queryQuote...")
            await new Promise((resolve) => setTimeout(resolve, 1500))
            throw new Error("not implemented")
          }),
          // @ts-expect-error For some reason `swapIntentMachine` does not satisfy `swap` actor type
          swap: swapIntentMachine,
        },
      })}
    >
      {children}
    </SwapUIMachineContext.Provider>
  )
}
