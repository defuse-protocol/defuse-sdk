import { createActorContext } from "@xstate/react"
import type { PropsWithChildren } from "react"
import { useFormContext } from "react-hook-form"
import { formatUnits } from "viem"
import { fromPromise } from "xstate"
import type {
  SwappableToken,
  WalletMessage,
  WalletSignatureResult,
} from "../../../types"
import { queryQuoteMachine } from "../../machines/queryQuoteMachine"
import { swapIntentMachine } from "../../machines/swapIntentMachine"
import { swapUIMachine } from "../../machines/swapUIMachine"
import type { SwapFormValues } from "./SwapForm"

export const SwapUIMachineContext = createActorContext(swapUIMachine)

interface SwapUIMachineProviderProps extends PropsWithChildren {
  assetIn: SwappableToken
  assetOut: SwappableToken
  signMessage: (params: WalletMessage) => Promise<WalletSignatureResult | null>
}

export function SwapUIMachineProvider({
  children,
  assetIn,
  assetOut,
  signMessage,
}: SwapUIMachineProviderProps) {
  const { trigger, getValues, setValue, resetField } =
    useFormContext<SwapFormValues>()

  return (
    <SwapUIMachineContext.Provider
      options={{
        input: {
          tokenIn: assetIn,
          tokenOut: assetOut,
        },
      }}
      logic={swapUIMachine.provide({
        delays: {
          quotePollingInterval: 1000, // temporary increase to 5 sec during development in order to reduce polluting the logs
        },
        actions: {
          updateUIAmountOut: ({ context }) => {
            const quote = context.quote
            if (quote) {
              const amountOutFormatted = formatUnits(
                BigInt(quote.totalAmountOut),
                context.formValues.tokenOut.decimals
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
          queryQuote: queryQuoteMachine,
          // @ts-expect-error For some reason `swapIntentMachine` does not satisfy `swap` actor type
          swap: swapIntentMachine.provide({
            actors: {
              signMessage: fromPromise(({ input }) => signMessage(input)),
            },
          }),
        },
      })}
    >
      {children}
    </SwapUIMachineContext.Provider>
  )
}
