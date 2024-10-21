import { createActorContext } from "@xstate/react"
import { parseUnits } from "ethers"
import type { PropsWithChildren } from "react"
import { useFormContext } from "react-hook-form"
import { formatUnits } from "viem"
import { fromPromise } from "xstate"
import type {
  SwappableToken,
  WalletMessage,
  WalletSignatureResult,
} from "../../../types"
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
          queryQuote: fromPromise(async ({ input }) => {
            const { amountIn } = getValues()

            // todo: may throw if too many decimals, need to write safe parser
            const amountInParsed = parseUnits(amountIn, assetIn.decimals)

            // todo: replace code below with real quote request
            console.warn("Do real quote request here")

            // Simulate quote with a random factor around 1.5x amountInParsed
            const baseAmountOut = (amountInParsed * 3n) / 2n

            const randomFactor = (min: number, max: number) =>
              BigInt(Math.floor(Math.random() * (max - min + 1) + min))

            // Apply random factor within ±3%
            const minFactor = 97
            const maxFactor = 103
            const randomMultiplier = randomFactor(minFactor, maxFactor)

            const amountOutRandomized =
              (baseAmountOut * randomMultiplier) / 100n

            return {
              quoteHashes: ["quoteHash"],
              expirationTime: Math.floor(Date.now() / 1000) + 10 * 60,
              totalAmountOut: amountOutRandomized,
              amountsOut: {
                // biome-ignore lint/style/noNonNullAssertion: <reason>
                [input.tokensOut[0]!]: amountOutRandomized,
              },
            }
          }),
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
