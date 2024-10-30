import { useState } from "react"
import { formatUnits } from "viem"
import { fromPromise } from "xstate"
import { WithdrawWidgetProvider } from "../../../providers/WithdrawWidgetProvider"
import type { WithdrawWidgetProps } from "../../../types/withdraw"
import { isBaseToken } from "../../../utils"
import { assert } from "../../../utils/assert"
import { swapIntentMachine } from "../../machines/swapIntentMachine"
import { swapUIMachine } from "../../machines/swapUIMachine"
import { SwapUIMachineContext } from "../../swap/components/SwapUIMachineProvider"
import { WithdrawForm } from "./WithdrawForm"

export const WithdrawWidget = (props: WithdrawWidgetProps) => {
  const [initialTokenIn] = props.tokenList
  assert(initialTokenIn, "Token list must have at least 1 token")

  const initialTokenOut = isBaseToken(initialTokenIn)
    ? initialTokenIn
    : initialTokenIn.groupedTokens[0]

  assert(
    initialTokenOut != null && isBaseToken(initialTokenOut),
    "Token out must be base token"
  )

  const [amountOutFormatted, setAmountOutFormatted] = useState("")

  return (
    <WithdrawWidgetProvider>
      <SwapUIMachineContext.Provider
        options={{
          input: {
            tokenIn: initialTokenIn,
            tokenOut: initialTokenOut,
            tokenList: props.tokenList,
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
                setAmountOutFormatted(amountOutFormatted)
              } else {
                setAmountOutFormatted("")
              }
            },
          },
          actors: {
            formValidationActor: fromPromise(async () => {
              console.warn("add real amount in check")
              return true
            }),
            swapActor: swapIntentMachine.provide({
              actors: {
                signMessage: fromPromise(({ input }) =>
                  props.signMessage(input)
                ),
              },
            }),
          },
        })}
      >
        <WithdrawForm {...props} amountOutFormatted={amountOutFormatted} />
      </SwapUIMachineContext.Provider>
    </WithdrawWidgetProvider>
  )
}
