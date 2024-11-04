import { createActorContext } from "@xstate/react"
import type { PropsWithChildren, ReactElement, ReactNode } from "react"
import { useFormContext } from "react-hook-form"
import { formatUnits } from "viem"
import {
  type Actor,
  type ActorOptions,
  type SnapshotFrom,
  fromPromise,
} from "xstate"
import type {
  SwappableToken,
  WalletMessage,
  WalletSignatureResult,
} from "../../../types"
import { swapIntentMachine } from "../../machines/swapIntentMachine"
import { swapUIMachine } from "../../machines/swapUIMachine"
import type { SwapFormValues } from "./SwapForm"

/**
 * We explicitly define the type of `swapUIMachine` to avoid:
 * ```
 * TS7056: The inferred type of this node exceeds the maximum length the
 * compiler will serialize. An explicit type annotation is needed.
 * ```
 *
 * Either the machine type is too complex or we incorrectly specify types inside it.
 * Either way it is just a workaround for TypeScript limitations.
 * Copy-paste the type from `@xstate/react/dist/declarations/src/createActorContext.d.ts`
 */
interface SwapUIMachineContextInterface {
  useSelector: <T>(
    selector: (snapshot: SnapshotFrom<typeof swapUIMachine>) => T,
    compare?: (a: T, b: T) => boolean
  ) => T
  useActorRef: () => Actor<typeof swapUIMachine>
  Provider: (props: {
    children: ReactNode
    options?: ActorOptions<typeof swapUIMachine>
    /** @deprecated Use `logic` instead. */
    machine?: never
    logic?: typeof swapUIMachine
    // biome-ignore lint/suspicious/noExplicitAny: it is fine `any` here
  }) => ReactElement<any, any>
}

export const SwapUIMachineContext: SwapUIMachineContextInterface =
  createActorContext(swapUIMachine)

interface SwapUIMachineProviderProps extends PropsWithChildren {
  initialTokenIn: SwappableToken
  initialTokenOut: SwappableToken
  tokenList: SwappableToken[]
  signMessage: (params: WalletMessage) => Promise<WalletSignatureResult | null>
}

export function SwapUIMachineProvider({
  children,
  initialTokenIn,
  initialTokenOut,
  tokenList,
  signMessage,
}: SwapUIMachineProviderProps) {
  const { trigger, setValue } = useFormContext<SwapFormValues>()

  return (
    <SwapUIMachineContext.Provider
      options={{
        input: {
          tokenIn: initialTokenIn,
          tokenOut: initialTokenOut,
          tokenList,
        },
      }}
      logic={swapUIMachine.provide({
        actions: {
          updateUIAmountOut: ({ context }) => {
            const quote = context.quote
            if (quote) {
              const amountOutFormatted = formatUnits(
                quote.totalAmountOut,
                context.formValues.tokenOut.decimals
              )
              setValue("amountOut", amountOutFormatted)
            } else {
              setValue("amountOut", "")
            }
          },
        },
        actors: {
          formValidationActor: fromPromise(async () => {
            // We validate only `amountIn` and not entire form, because currently `amountOut` is also part of the form
            return trigger("amountIn")
          }),
          swapActor: swapIntentMachine.provide({
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
