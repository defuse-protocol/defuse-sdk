import { assign, fromPromise } from "xstate"
import { WidgetRoot } from "../../../components/WidgetRoot"
import { settings } from "../../../config/settings"
import { auroraEngineContractId } from "../../../constants/aurora"
import { WithdrawWidgetProvider } from "../../../providers/WithdrawWidgetProvider"
import type { WithdrawWidgetProps } from "../../../types/withdraw"
import { assert } from "../../../utils/assert"
import {
  makeInnerSwapAndWithdrawMessage,
  makeSwapMessage,
} from "../../../utils/messageFactory"
import { isBaseToken } from "../../../utils/token"
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
    <WidgetRoot>
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
                        nep141Storage,
                        recipient,
                        destinationMemo,
                      } = context.intentOperationParams

                      const totalAmountWithdrawn = calcOperationAmountOut(
                        context.intentOperationParams
                      )

                      const tokenOutAccountId =
                        tokenOut.defuseAssetId.split(":")[1]
                      assert(
                        tokenOutAccountId != null,
                        "Token out account id must be defined"
                      )

                      assert(
                        tokenOut.chainName !== "xrpledger"
                          ? destinationMemo === null
                          : true,
                        "Destination memo may exist only for XRP Ledger"
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
                            case "aurora":
                              return {
                                type: "to_aurora_engine",
                                amount: totalAmountWithdrawn,
                                tokenAccountId: tokenOutAccountId,
                                auroraEngineContractId:
                                  auroraEngineContractId[tokenOut.chainName],
                                destinationAddress: recipient,
                              }
                            default:
                              return {
                                type: "via_poa_bridge",
                                amount: totalAmountWithdrawn,
                                tokenAccountId: tokenOutAccountId,
                                destinationAddress: recipient,
                                destinationMemo,
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
    </WidgetRoot>
  )
}
