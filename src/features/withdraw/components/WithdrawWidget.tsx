import { assign, fromPromise } from "xstate"
import { settings } from "../../../config/settings"
import { WithdrawWidgetProvider } from "../../../providers/WithdrawWidgetProvider"
import type { WithdrawWidgetProps } from "../../../types/withdraw"
import { isBaseToken } from "../../../utils"
import { assert } from "../../../utils/assert"
import {
  makeInnerSwapAndWithdrawMessage,
  makeSwapMessage,
} from "../../../utils/messageFactory"
import {
  calcOperationAmountOut,
  swapIntentMachine,
} from "../../machines/swapIntentMachine"
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

                    const { tokenOut, quote, nep141Storage, recipient } =
                      context.intentOperationParams

                    const totalAmountWithdrawn = calcOperationAmountOut(
                      context.intentOperationParams
                    )

                    const tokenOutAccountId =
                      tokenOut.defuseAssetId.split(":")[1]
                    assert(
                      tokenOutAccountId != null,
                      "Token out account id must be defined"
                    )

                    const innerMessage = makeInnerSwapAndWithdrawMessage({
                      tokenDeltas: [
                        ...(quote?.tokenDeltas ?? []),
                        ...(nep141Storage?.quote?.tokenDeltas ?? []),
                      ],
                      withdrawParams: (() => {
                        switch (tokenOut.chainName) {
                          case "near":
                            return {
                              type: "to_near",
                              amount: totalAmountWithdrawn,
                              receiverId: recipient,
                              tokenAccountId: tokenOutAccountId,
                              storageDeposit:
                                nep141Storage?.requiredStorageNEAR ?? 0n,
                            }
                          case "turbochain":
                            return {
                              type: "to_aurora_engine",
                              amount: totalAmountWithdrawn,
                              tokenAccountId: tokenOutAccountId,
                              // todo: move account ids mapping to somewhere else (maybe they can be placed to token object itself?)
                              auroraEngineContractId: {
                                turbochain: "0x4e45415f.c.aurora",
                                aurora: "aurora",
                              }[tokenOut.chainName],
                              destinationAddress: recipient,
                            }
                          default:
                            return {
                              type: "via_poa_bridge",
                              amount: totalAmountWithdrawn,
                              tokenAccountId: tokenOutAccountId,
                              destinationAddress: recipient,
                            }
                        }
                      })(),
                      signerId: context.defuseUserId,
                      deadlineTimestamp:
                        // Expiry time maybe zero if nothing to swap, so let's just fallback to the default
                        Date.now() + 10 * 60 * 1000,
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
