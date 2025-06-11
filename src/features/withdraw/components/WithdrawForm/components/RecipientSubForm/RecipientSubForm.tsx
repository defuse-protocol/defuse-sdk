import { MagicWandIcon, PersonIcon } from "@radix-ui/react-icons"
import { Box, Flex, IconButton, Text, TextField } from "@radix-ui/themes"
import { useSelector } from "@xstate/react"
import { useEffect, useRef, useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { Controller } from "react-hook-form"
import { EmptyIcon } from "../../../../../../components/EmptyIcon"
import { ModalSelectNetwork } from "../../../../../../components/Network/ModalSelectNetwork"
import { Select } from "../../../../../../components/Select/Select"
import { SelectTriggerLike } from "../../../../../../components/Select/SelectTriggerLike"
import { parseDestinationMemo } from "../../../../../../features/machines/withdrawFormReducer"
import { WithdrawUIMachineContext } from "../../../../../../features/withdraw/WithdrawUIMachineContext"
import { useSolverLiquidityQuery } from "../../../../../../queries/solverLiquidityQuerires"
import type { BlockchainEnum } from "../../../../../../sdk/poaBridge/constants/blockchains"
import type { ModalType } from "../../../../../../stores/modalStore"
import type { AuthMethod } from "../../../../../../types"
import type {
  BaseTokenInfo,
  SupportedChainName,
  TokenValue,
  UnifiedTokenInfo,
} from "../../../../../../types/base"
import { reverseAssetNetworkAdapter } from "../../../../../../utils/adapters"
import { parseUnits } from "../../../../../../utils/parse"
import { getTokenMaxDecimals } from "../../../../../../utils/tokenUtils"
import {
  type HLDepositAddressResult,
  useCreateHLDepositAddress,
} from "../../hooks/useCreateHLDepositAddress"
import { useTokenBalances } from "../../hooks/useTokenBalances"
import type { WithdrawFormNearValues } from "../../index"
import { balancesSelector } from "../../selectors"
import {
  chainTypeSatisfiesChainName,
  getBlockchainSelectItems,
  getFastWithdrawals,
} from "../../utils"
import { truncateUserAddress } from "../../utils"
import { HotBalance } from "../HotBalance/HotBalance"
import { LongWithdrawWarning } from "../LongWithdrawWarning"
import { validateAddressSoft } from "./validation"

type RecipientSubFormProps = {
  form: UseFormReturn<WithdrawFormNearValues>
  modalSelectAssetsData:
    | {
        modalType: ModalType
        token: BaseTokenInfo | UnifiedTokenInfo | undefined
      }
    | undefined
  chainType: AuthMethod | undefined
  userAddress: string | undefined
  tokenInBalance: TokenValue | undefined
}

export const RecipientSubForm = ({
  form: {
    control,
    register,
    setValue,
    watch,
    formState: { errors },
  },
  modalSelectAssetsData,
  chainType,
  userAddress,
  tokenInBalance,
}: RecipientSubFormProps) => {
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false)
  const actorRef = WithdrawUIMachineContext.useActorRef()
  const { formRef, balances: balancesData } =
    WithdrawUIMachineContext.useSelector((state) => {
      return {
        state,
        formRef: state.context.withdrawFormRef,
        balances: balancesSelector(state),
      }
    })

  const { token, tokenOut, blockchain, amountIn, parsedAmountIn, recipient } =
    useSelector(formRef, (state) => {
      const { tokenOut } = state.context

      return {
        blockchain: tokenOut.chainName,
        token: state.context.tokenIn,
        tokenOut: state.context.tokenOut,
        amountIn: state.context.amount,
        parsedAmountIn: state.context.parsedAmount,
        recipient: state.context.recipient,
      }
    })

  const isChainTypeSatisfiesChainName = chainTypeSatisfiesChainName(
    chainType,
    tokenOut.chainName
  )

  const hasAnyBalance = tokenInBalance != null && tokenInBalance?.amount > 0
  const poaBridgeBalances = useTokenBalances(token, hasAnyBalance)
  const { data: liquidityData } = useSolverLiquidityQuery()

  const maxWithdrawals = hasAnyBalance
    ? getFastWithdrawals(token, balancesData, poaBridgeBalances, liquidityData)
    : {}

  const blockchainSelectItems = getBlockchainSelectItems(token, maxWithdrawals)
  const showHotBalances = Object.keys(maxWithdrawals).length > 0

  const resetDisplayBlockchainRef = useRef<boolean>(true)

  const onCloseNetworkModal = () => setIsNetworkModalOpen(false)

  const onChangeNetwork = (network: SupportedChainName) => {
    setValue("blockchain", network)
    onCloseNetworkModal()
  }

  const { data: hyperliquidDepositAddress } = useCreateHLDepositAddress(
    tokenOut,
    watch("blockchain"),
    watch("recipient")
  )

  useEffect(() => {
    if (resetDisplayBlockchainRef.current) {
      resetDisplayBlockchainRef.current = false
      setValue("blockchain", blockchain)
    }
  }, [blockchain, setValue])

  useEffect(() => {
    if (hyperliquidDepositAddress?.tag === "ok") {
      const blockchain =
        hyperliquidDepositAddress.value === null
          ? watch("blockchain")
          : hyperliquidDepositAddress.value.chainName
      actorRef.send({
        type: "WITHDRAW_FORM.UPDATE_BLOCKCHAIN",
        params: { blockchain },
      })

      const recipient = getRecipientAddress(
        hyperliquidDepositAddress,
        watch("recipient")
      )
      actorRef.send({
        type: "WITHDRAW_FORM.RECIPIENT",
        params: { recipient },
      })
    }
  }, [hyperliquidDepositAddress, watch, actorRef])

  /**
   * This is ModalSelectAssets "callback"
   */
  useEffect(() => {
    if (modalSelectAssetsData?.token) {
      const token = modalSelectAssetsData.token
      modalSelectAssetsData.token = undefined // consume data, so it won't be triggered again
      const parsedAmount = {
        amount: 0n,
        decimals: getTokenMaxDecimals(token),
      }
      try {
        parsedAmount.amount = parseUnits(amountIn, parsedAmount.decimals)
      } catch {}
      actorRef.send({
        type: "WITHDRAW_FORM.UPDATE_TOKEN",
        params: {
          token: token,
          parsedAmount: parsedAmount,
        },
      })
      // Reset displayed blockchain so it gets updated with the new token's default blockchain
      resetDisplayBlockchainRef.current = true
    }
  }, [modalSelectAssetsData, actorRef, amountIn])

  return (
    <Flex direction="column" gap="2">
      <Box px="2" asChild>
        <Text size="1" weight="bold">
          Recipient
        </Text>
      </Box>
      <Controller
        name="blockchain"
        control={control}
        rules={{
          required: "This field is required",
          deps: "recipient",
        }}
        render={({ field }) => (
          <>
            <SelectTriggerLike
              label={
                blockchainSelectItems[field.value]?.label ?? "Select network"
              }
              icon={blockchainSelectItems[field.value]?.icon ?? <EmptyIcon />}
              onClick={() => setIsNetworkModalOpen(true)}
              hint={
                <Select.Hint>
                  {Object.keys(blockchainSelectItems).length === 1
                    ? "This network only"
                    : "Network"}
                </Select.Hint>
              }
              disabled={
                Object.keys(blockchainSelectItems).length === 1 &&
                field.value === Object.values(blockchainSelectItems)[0]?.value
              }
            />

            <ModalSelectNetwork
              token={token}
              selectNetwork={onChangeNetwork}
              selectedNetwork={watch("blockchain")}
              isOpen={isNetworkModalOpen}
              onClose={() => setIsNetworkModalOpen(false)}
              renderValueDetails={
                showHotBalances
                  ? (address: string) => (
                      <HotBalance
                        symbol={tokenOut.symbol}
                        hotBalance={
                          blockchainSelectItems[
                            reverseAssetNetworkAdapter[
                              address as BlockchainEnum
                            ]
                          ]?.hotBalance
                        }
                      />
                    )
                  : undefined
              }
            />
          </>
        )}
      />

      {tokenOut.bridge === "poa" && showHotBalances && (
        <LongWithdrawWarning
          amountIn={parsedAmountIn}
          symbol={tokenOut.symbol}
          hotBalance={blockchainSelectItems[tokenOut.chainName]?.hotBalance}
        />
      )}

      <Flex direction="column" gap="1">
        <Flex gap="2" align="center">
          <Box asChild flexGrow="1">
            <TextField.Root
              size="3"
              {...register("recipient", {
                validate: {
                  pattern: (value, formValues) => {
                    if (!validateAddressSoft(value, formValues.blockchain)) {
                      return "Invalid address for the selected blockchain"
                    }
                  },
                },
              })}
              placeholder="Enter wallet address"
            >
              <TextField.Slot>
                <PersonIcon height="16" width="16" />
              </TextField.Slot>
            </TextField.Root>
          </Box>

          {isChainTypeSatisfiesChainName &&
            userAddress != null &&
            recipient !== userAddress && (
              <IconButton
                type="button"
                onClick={() => {
                  setValue("recipient", userAddress, {
                    shouldValidate: true,
                  })
                }}
                variant="outline"
                size="3"
                title={`Autofill with your address ${truncateUserAddress(
                  userAddress
                )}`}
                aria-label={`Autofill with your address ${truncateUserAddress(
                  userAddress
                )}`}
              >
                <MagicWandIcon />
              </IconButton>
            )}
        </Flex>

        {errors.recipient && (
          <Box px="2" asChild>
            <Text size="1" color="red" weight="medium">
              {errors.recipient.message}
            </Text>
          </Box>
        )}
      </Flex>

      <Controller
        name="blockchain"
        control={control}
        render={({ field }) =>
          field.value === "xrpledger" ? (
            <Flex direction="column" gap="1">
              <Box px="2" asChild>
                <Text size="1" weight="bold">
                  Destination Tag (optional)
                </Text>
              </Box>
              <TextField.Root
                size="3"
                {...register("destinationMemo", {
                  validate: {
                    uint32: (value) => {
                      if (value == null || value === "") return

                      if (
                        parseDestinationMemo(value, tokenOut.chainName) == null
                      ) {
                        return "Should be a number"
                      }
                    },
                  },
                })}
                placeholder="Enter destination tag"
              />
              {errors.destinationMemo && (
                <Box px="2" asChild>
                  <Text size="1" color="red" weight="medium">
                    {errors.destinationMemo.message}
                  </Text>
                </Box>
              )}
            </Flex>
          ) : (
            <></>
          )
        }
      />
    </Flex>
  )
}

const getRecipientAddress = (
  hyperliquidDepositAddress: HLDepositAddressResult,
  recipientValue: string
): string => {
  if (hyperliquidDepositAddress?.tag === "err") {
    return ""
  }
  if (
    hyperliquidDepositAddress?.tag === "ok" &&
    hyperliquidDepositAddress.value
  ) {
    return hyperliquidDepositAddress.value.depositAddress
  }
  return recipientValue
}
