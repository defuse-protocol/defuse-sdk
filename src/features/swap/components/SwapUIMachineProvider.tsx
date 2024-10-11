import { createActorContext } from "@xstate/react"
import { parseUnits } from "ethers"
import type { PropsWithChildren } from "react"
import { useFormContext } from "react-hook-form"
import { formatUnits } from "viem"
import { fromPromise } from "xstate"
import type { BaseTokenInfo } from "../../../types/base"
import { swapIntentMachine } from "../../machines/swapIntentMachine"
import { type QuoteTmp, swapUIMachine } from "../../machines/swapUIMachine"
import type { SwapFormValues } from "./SwapForm"

export const SwapUIMachineContext = createActorContext(swapUIMachine)

interface SwapUIMachineProviderProps extends PropsWithChildren {
  assetIn: BaseTokenInfo
  assetOut: BaseTokenInfo
}

export function SwapUIMachineProvider({
  children,
  assetIn,
  assetOut,
}: SwapUIMachineProviderProps) {
  const { trigger, getValues, setValue, resetField } =
    useFormContext<SwapFormValues>()

  return (
    <SwapUIMachineContext.Provider
      logic={swapUIMachine.provide({
        delays: {
          quotePollingInterval: 5000, // temporary increase to 5 sec during development in order to reduce polluting the logs
        },
        actions: {
          updateUIAmountOut: ({ context }) => {
            const quote = context.quotes?.[0]
            if (quote) {
              const amountOut = quote.amount_out
              const amountOutFormatted = formatUnits(
                BigInt(amountOut),
                assetOut.decimals
              )
              setValue("amountOut", amountOutFormatted)
            } else {
              setValue("amountOut", "")
            }
          },
        },
        actors: {
          formValidation: fromPromise(async () => {
            // We validate only `amountIn` and not entire form, because currently `amountOut` is also part of the form
            return trigger("amountIn")
          }),
          queryQuote: fromPromise(async (): Promise<QuoteTmp[]> => {
            const { amountIn } = getValues()

            // todo: may throw if too many decimals, need to write safe parser
            const amountInParsed = parseUnits(amountIn, assetIn.decimals)

            // todo: replace with real quote
            return [{ amount_out: ((amountInParsed * 3n) / 2n).toString() }]
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
