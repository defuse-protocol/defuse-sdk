import { assign, fromPromise } from "xstate"
import { WidgetRoot } from "../../../components/WidgetRoot"
import { auroraEngineContractId } from "../../../constants/aurora"
import { settings } from "../../../constants/settings"
import { WithdrawWidgetProvider } from "../../../providers/WithdrawWidgetProvider"
import { DeprecatedTokensService } from "../../../services/deprecatedTokensService"
import type { WithdrawWidgetProps } from "../../../types/withdraw"
import { assert } from "../../../utils/assert"
import {
  makeInnerSwapAndWithdrawMessage,
  makeSwapMessage,
} from "../../../utils/messageFactory"
import { isBaseToken } from "../../../utils/token"
import { adjustDecimals } from "../../../utils/tokenUtils"
import {
  calcOperationAmountOut,
  swapIntentMachine,
} from "../../machines/swapIntentMachine"
import { withdrawUIMachine } from "../../machines/withdrawUIMachine"
import { WithdrawUIMachineContext } from "../WithdrawUIMachineContext"
import { WithdrawForm } from "./WithdrawForm"

export const WithdrawWidget = (props: WithdrawWidgetProps) => {
  DeprecatedTokensService.makeInstance(props.deprecatedTokenList)

  const initialTokenIn =
    props.presetTokenSymbol !== undefined
      ? (props.tokenList.find(
          (el) =>
            el.symbol.toLowerCase().normalize() ===
            props.presetTokenSymbol?.toLowerCase().normalize()
        ) ?? props.tokenList[0])
      : props.tokenList[0]

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
              referral: props.referral,
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
                        nep141Storage,
                        recipient,
                        destinationMemo,
                        quote,
                      } = context.intentOperationParams

                      const totalAmountWithdrawn = calcOperationAmountOut(
                        context.intentOperationParams,
                        quote
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
                        tokenDeltas: quote?.tokenDeltas ?? [],
                        storageTokenDeltas:
                          nep141Storage?.quote?.tokenDeltas ?? [],
                        withdrawParams: (() => {
                          const bridge = tokenOut.bridge
                          switch (bridge) {
                            case "direct":
                              return {
                                type: "to_near",
                                amount: adjustDecimals(
                                  totalAmountWithdrawn.amount,
                                  totalAmountWithdrawn.decimals,
                                  tokenOut.decimals
                                ),
                                receiverId: recipient,
                                tokenAccountId: tokenOutAccountId,
                                storageDeposit:
                                  nep141Storage?.requiredStorageNEAR ?? 0n,
                              }

                            case "aurora_engine": {
                              const contractId = (
                                auroraEngineContractId as Record<string, string>
                              )[tokenOut.chainName]

                              assert(
                                contractId != null,
                                `AuroraEngine contract id is not specified for "${tokenOut.chainName}"`
                              )

                              return {
                                type: "to_aurora_engine",
                                amount: adjustDecimals(
                                  totalAmountWithdrawn.amount,
                                  totalAmountWithdrawn.decimals,
                                  tokenOut.decimals
                                ),
                                tokenAccountId: tokenOutAccountId,
                                auroraEngineContractId: contractId,
                                destinationAddress: recipient,
                              }
                            }

                            case "poa":
                              return {
                                type: "via_poa_bridge",
                                amount: adjustDecimals(
                                  totalAmountWithdrawn.amount,
                                  totalAmountWithdrawn.decimals,
                                  tokenOut.decimals
                                ),
                                tokenAccountId: tokenOutAccountId,
                                destinationAddress: recipient,
                                destinationMemo,
                              }

                            default:
                              bridge satisfies never
                              throw new Error(`Unsupported bridge "${bridge}"`)
                          }
                        })(),
                        signerId: context.defuseUserId,
                        deadlineTimestamp:
                          Date.now() + settings.swapExpirySec * 1000,
                        referral: context.referral,
                      })

                      return {
                        innerMessage,
                        walletMessage: makeSwapMessage({ innerMessage }),
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
