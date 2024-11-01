import { type ActorRefFrom, assign, fromPromise } from "xstate"
import { settings } from "../../../config/settings"
import { WithdrawWidgetProvider } from "../../../providers/WithdrawWidgetProvider"
import type { WithdrawWidgetProps } from "../../../types/withdraw"
import { isBaseToken, isFungibleToken } from "../../../utils"
import { assert } from "../../../utils/assert"
import {
  makeInnerSwapAndWithdrawMessage,
  makeSwapMessage,
} from "../../../utils/messageFactory"
import { swapIntentMachine } from "../../machines/swapIntentMachine"
import type { withdrawFormReducer } from "../../machines/withdrawFormReducer"
import { withdrawUIMachine } from "../../machines/withdrawUIMachine"
import { WithdrawUIMachineContext } from "../WithdrawUIMachineContext"
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

  return (
    <WithdrawWidgetProvider>
      <WithdrawUIMachineContext.Provider
        options={{
          input: {
            tokenIn: initialTokenIn,
            tokenOut: initialTokenOut,
            tokenList: props.tokenList,
          },
        }}
        logic={withdrawUIMachine.provide({
          actions: {
            updateUIAmountOut: () => {
              // todo: implement this
            },
          },
          actors: {
            formValidationActor: fromPromise(async () => {
              console.warn("add real amount in check")
              return true
            }),
            swapActor: swapIntentMachine.provide({
              actors: {
                signMessage: fromPromise(({ input }) => {
                  console.log("signMessage")
                  const a = props.signMessage(input)
                  console.log({ a })
                  return a
                }),
              },
              actions: {
                assembleSignMessages: assign({
                  messageToSign: ({ context }) => {
                    assert(
                      context.intentOperationParams.type === "withdraw",
                      "Type must be withdraw"
                    )

                    const {
                      tokenOut,
                      quote,
                      directWithdrawalAmount,
                      recipient,
                    } = context.intentOperationParams

                    assert(
                      isFungibleToken(tokenOut) &&
                        tokenOut.chainName === "near",
                      "Token out must be fungible base token with source on NEAR"
                    )

                    const totalAmountWithdrawn =
                      directWithdrawalAmount + (quote?.totalAmountOut ?? 0n)

                    const innerMessage = makeInnerSwapAndWithdrawMessage({
                      swapParams: quote,
                      withdrawParams: {
                        type: "to_near",
                        amount: totalAmountWithdrawn,
                        receiverId: recipient,
                        tokenAccountId: tokenOut.address,
                      },
                      signerId: context.userAddress,
                      deadlineTimestamp:
                        // Expiry time maybe zero if nothing to swap, so let's just fallback to the default
                        Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
                    })

                    return {
                      innerMessage,
                      walletMessage: makeSwapMessage({
                        innerMessage,
                        recipient: settings.defuseContractId,
                      }),
                    }
                  },
                }),
              },
            }),
          },
        })}
      >
        <WithdrawForm {...props} />
      </WithdrawUIMachineContext.Provider>
    </WithdrawWidgetProvider>
  )
}
