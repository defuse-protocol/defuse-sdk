import { assign, fromPromise } from "xstate"
import { settings } from "../../../config/settings"
import { WithdrawWidgetProvider } from "../../../providers/WithdrawWidgetProvider"
import type { WithdrawWidgetProps } from "../../../types/withdraw"
import { isBaseToken } from "../../../utils"
import { assert } from "../../../utils/assert"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import {
  makeInnerSwapAndWithdrawMessage,
  makeSwapMessage,
} from "../../../utils/messageFactory"
import { swapIntentMachine } from "../../machines/swapIntentMachine"
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
          actors: {
            swapActor: swapIntentMachine.provide({
              actors: {
                signMessage: fromPromise(({ input }) => {
                  return props.signMessage(input)
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

                    const totalAmountWithdrawn =
                      directWithdrawalAmount + (quote?.totalAmountOut ?? 0n)

                    const tokenOutAccountId =
                      tokenOut.defuseAssetId.split(":")[1]
                    assert(
                      tokenOutAccountId != null,
                      "Token out account id must be defined"
                    )

                    const innerMessage = makeInnerSwapAndWithdrawMessage({
                      swapParams: quote,
                      withdrawParams:
                        tokenOut.chainName === "near"
                          ? {
                              type: "to_near",
                              amount: totalAmountWithdrawn,
                              receiverId: recipient,
                              tokenAccountId: tokenOutAccountId,
                            }
                          : {
                              type: "via_poa_bridge",
                              amount: totalAmountWithdrawn,
                              tokenAccountId: tokenOutAccountId,
                              destinationAddress: recipient,
                            },
                      signerId: userAddressToDefuseUserId(context.userAddress),
                      deadlineTimestamp:
                        // Expiry time maybe zero if nothing to swap, so let's just fallback to the default
                        Math.floor(Date.now() / 1000) + 10 * 60,
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
