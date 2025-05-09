import { MagicWandIcon, PersonIcon } from "@radix-ui/react-icons"
import {
  Box,
  Checkbox,
  Flex,
  IconButton,
  Skeleton,
  Text,
  TextField,
  Tooltip,
} from "@radix-ui/themes"
import { useSelector } from "@xstate/react"
import { useEffect, useState } from "react"
import { Controller, useController, useForm } from "react-hook-form"
import { ModalSelectNetwork } from "src/components/Network/ModalSelectNetwork"
import { SelectTriggerLike } from "src/components/Select/SelectTriggerLike"
import { useModalController } from "src/hooks/useModalController"
import { useTokensUsdPrices } from "src/hooks/useTokensUsdPrices"
import { useTokensStore } from "src/providers/TokensStoreProvider"
import type { BlockchainEnum } from "src/sdk/poaBridge/constants/blockchains"
import { ModalType } from "src/stores/modalStore"
import { reverseAssetNetworkAdapter } from "src/utils/adapters"
import { isSupportedChainName } from "src/utils/blockchain"
import { formatTokenValue, formatUsdAmount } from "src/utils/format"
import getTokenUsdPrice from "src/utils/getTokenUsdPrice"
import { getTokenMaxDecimals } from "src/utils/tokenUtils"
import { AuthGate } from "../../../../components/AuthGate"
import { ButtonCustom } from "../../../../components/Button/ButtonCustom"
import { EmptyIcon } from "../../../../components/EmptyIcon"
import { Form } from "../../../../components/Form"
import { FieldComboInput } from "../../../../components/Form/FieldComboInput"
import { Island } from "../../../../components/Island"
import { IslandHeader } from "../../../../components/IslandHeader"
import { Select } from "../../../../components/Select/Select"
import { nearClient } from "../../../../constants/nearClient"
import { logger } from "../../../../logger"
import type {
  BaseTokenInfo,
  SupportedChainName,
  TokenValue,
  UnifiedTokenInfo,
} from "../../../../types/base"
import type { WithdrawWidgetProps } from "../../../../types/withdraw"
import { parseUnits } from "../../../../utils/parse"
import { validateAddress } from "../../../../utils/validateAddress"
import {
  balanceSelector,
  transitBalanceSelector,
} from "../../../machines/depositedBalanceMachine"
import { getPOABridgeInfo } from "../../../machines/poaBridgeInfoActor"
import { parseDestinationMemo } from "../../../machines/withdrawFormReducer"
import { renderIntentCreationResult } from "../../../swap/components/SwapForm"
import { usePublicKeyModalOpener } from "../../../swap/hooks/usePublicKeyModalOpener"
import { WithdrawUIMachineContext } from "../../WithdrawUIMachineContext"
import {
  HotBalance,
  Intents,
  LongWithdrawWarning,
  MinWithdrawalAmount,
  PreparationResult,
} from "./components"
import { SolverId, type allBlockchains } from "./constants"
import { useTokenBalances } from "./hooks/useTokenBalances"
import { useDepositBalances } from "./hooks/useTransitBalances"
import {
  isLiquidityUnavailableSelector,
  isUnsufficientTokenInAmount,
  totalAmountReceivedSelector,
} from "./selectors"
import {
  chainTypeSatisfiesChainName,
  getBlockchainSelectItems,
  getWithdrawButtonText,
  mergeBridgeBalances,
  shouldShowHotBalance,
  truncateUserAddress,
} from "./utils"

export type WithdrawFormNearValues = {
  amountIn: string
  recipient: string
  blockchain: SupportedChainName
  destinationMemo?: string
  isFundsLooseConfirmed?: boolean
}

type WithdrawFormProps = WithdrawWidgetProps

export const WithdrawForm = ({
  userAddress,
  chainType,
  tokenList,
  presetAmount,
  presetNetwork,
  presetRecipient,
  sendNearTransaction,
  renderHostAppLink,
}: WithdrawFormProps) => {
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false)

  const isLoggedIn = userAddress != null
  const actorRef = WithdrawUIMachineContext.useActorRef()
  const {
    state,
    formRef,
    swapRef,
    depositedBalanceRef,
    poaBridgeInfoRef,
    intentCreationResult,
    intentRefs,
    noLiquidity,
    insufficientTokenInAmount,
    totalAmountReceived,
  } = WithdrawUIMachineContext.useSelector((state) => {
    return {
      state,
      formRef: state.context.withdrawFormRef,
      swapRef: state.children.swapRef,
      depositedBalanceRef: state.context.depositedBalanceRef,
      poaBridgeInfoRef: state.context.poaBridgeInfoRef,
      intentCreationResult: state.context.intentCreationResult,
      intentRefs: state.context.intentRefs,
      noLiquidity: isLiquidityUnavailableSelector(state),
      insufficientTokenInAmount: isUnsufficientTokenInAmount(state),
      totalAmountReceived: totalAmountReceivedSelector(state),
    }
  })
  const publicKeyVerifierRef = useSelector(swapRef, (state) => {
    if (state) {
      return state.children.publicKeyVerifierRef
    }
  })

  // biome-ignore lint/suspicious/noExplicitAny: types should've been correct, but `publicKeyVerifierRef` is commented out
  usePublicKeyModalOpener(publicKeyVerifierRef as any, sendNearTransaction)

  useEffect(() => {
    if (userAddress != null && chainType != null) {
      actorRef.send({
        type: "LOGIN",
        params: { userAddress, userChainType: chainType },
      })
    } else {
      actorRef.send({
        type: "LOGOUT",
      })
    }
  }, [userAddress, actorRef, chainType])

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

  const minWithdrawalAmount = useSelector(poaBridgeInfoRef, (state) => {
    const bridgedTokenInfo = getPOABridgeInfo(state, tokenOut)
    return bridgedTokenInfo == null
      ? null
      : {
          amount: bridgedTokenInfo.minWithdrawal,
          decimals: tokenOut.decimals,
        }
  })

  const tokenInBalance = useSelector(
    depositedBalanceRef,
    balanceSelector(token)
  )

  const tokenInTransitBalance = useSelector(
    depositedBalanceRef,
    transitBalanceSelector(token)
  )

  const { data: tokensUsdPriceData } = useTokensUsdPrices()
  const {
    handleSubmit,
    register,
    control,
    watch,
    formState: { errors },
    setValue,
    getValues,
  } = useForm<WithdrawFormNearValues>({
    mode: "onSubmit",
    reValidateMode: "onChange",
    values: {
      amountIn,
      recipient,
      blockchain,
    },
    // `resetOptions` is needed exclusively for being able to use `values` option without bugs
    resetOptions: {
      // Fixes: prevent all errors from being cleared when `values` change
      keepErrors: true,
      // Fixes: `reValidateMode` is not working when `values` change
      keepIsSubmitted: true,
    },
  })

  const { field: fundsLooseConfirmedField } = useController({
    control,
    name: "isFundsLooseConfirmed",
    rules: {
      validate: {
        pattern: (value, formValues) => {
          if (formValues.blockchain !== "near") return true
          if (!value) return "Required"
        },
      },
    },
  })

  const { setModalType, data: modalSelectAssetsData } = useModalController<{
    modalType: ModalType
    token: BaseTokenInfo | UnifiedTokenInfo | undefined
  }>(ModalType.MODAL_SELECT_ASSETS)

  const onCloseNetworkModal = () => setIsNetworkModalOpen(false)

  const onChangeNetwork = (network: SupportedChainName) => {
    setValue("blockchain", network)
    onCloseNetworkModal()
  }

  const updateTokens = useTokensStore((state) => state.updateTokens)

  const handleSelect = () => {
    updateTokens(tokenList)
    const fieldName = "token"
    setModalType(ModalType.MODAL_SELECT_ASSETS, {
      fieldName,
      [fieldName]: token,
      balances: depositedBalanceRef?.getSnapshot().context.balances,
    })
  }

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
    }
  }, [modalSelectAssetsData, actorRef, amountIn])

  useEffect(() => {
    const sub = watch(async (value, { name }) => {
      if (name === "amountIn") {
        const amount = value[name] ?? ""
        let parsedAmount: TokenValue | null = null
        try {
          const decimals = getTokenMaxDecimals(token)
          parsedAmount = {
            amount: parseUnits(amount, decimals),
            decimals: decimals,
          }
        } catch {}

        actorRef.send({
          type: "WITHDRAW_FORM.UPDATE_AMOUNT",
          params: { amount, parsedAmount },
        })
      }
      if (name === "recipient") {
        actorRef.send({
          type: "WITHDRAW_FORM.RECIPIENT",
          params: { recipient: value[name] ?? "" },
        })
      }
      if (name === "destinationMemo") {
        actorRef.send({
          type: "WITHDRAW_FORM.UPDATE_DESTINATION_MEMO",
          params: { destinationMemo: value[name] ?? "" },
        })
      }
      if (name === "blockchain") {
        actorRef.send({
          type: "WITHDRAW_FORM.UPDATE_BLOCKCHAIN",
          params: { blockchain: value[name] ?? "" },
        })

        actorRef.send({
          type: "WITHDRAW_FORM.CEX_FUNDS_LOOSE_CHANGED",
          params: {
            cexFundsLooseConfirmation:
              value[name] === "near" ? "not_confirmed" : "not_required",
          },
        })
      }
      if (name === "isFundsLooseConfirmed") {
        actorRef.send({
          type: "WITHDRAW_FORM.CEX_FUNDS_LOOSE_CHANGED",
          params: {
            cexFundsLooseConfirmation: value[name]
              ? "confirmed"
              : "not_confirmed",
          },
        })
      }
    })
    return () => {
      sub.unsubscribe()
    }
  }, [watch, actorRef, token])

  useEffect(() => {
    if (presetAmount != null) {
      setValue("amountIn", presetAmount)
    }
    if (presetNetwork != null && isSupportedChainName(presetNetwork)) {
      setValue("blockchain", presetNetwork)
    }
    if (presetRecipient != null) {
      setValue("recipient", presetRecipient)
    }
  }, [presetAmount, presetNetwork, presetRecipient, setValue])

  useEffect(() => {
    const sub = actorRef.on("INTENT_PUBLISHED", () => {
      setValue("amountIn", "")
    })

    return () => {
      sub.unsubscribe()
    }
  }, [actorRef, setValue])

  const isChainTypeSatisfiesChainName = chainTypeSatisfiesChainName(
    chainType,
    tokenOut.chainName
  )

  const tokenToWithdrawUsdAmount = getTokenUsdPrice(
    getValues().amountIn,
    token,
    tokensUsdPriceData
  )

  const hasAnyBalance = tokenInBalance != null && tokenInBalance?.amount > 0

  const poaBridgeBalances = useTokenBalances(token, hasAnyBalance)
  const nonPoaBridgeBalances = useDepositBalances(
    { userId: SolverId, token },
    hasAnyBalance
  )

  const blockchainSelectItems = getBlockchainSelectItems(
    token,
    poaBridgeBalances,
    nonPoaBridgeBalances,
    tokensUsdPriceData
  )

  const balances = mergeBridgeBalances(poaBridgeBalances, nonPoaBridgeBalances)
  const showHotBalances = shouldShowHotBalance(balances, tokenInBalance)

  return (
    <Island className="widget-container flex flex-col gap-4">
      <IslandHeader heading="Withdraw" condensed />

      <Form<WithdrawFormNearValues>
        handleSubmit={handleSubmit(() => {
          if (userAddress == null || chainType == null) {
            logger.warn("No user address provided")
            return
          }

          actorRef.send({
            type: "submit",
            params: {
              userAddress,
              userChainType: chainType,
              nearClient,
            },
          })
        })}
        register={register}
      >
        <Flex direction="column" gap="5">
          <FieldComboInput<WithdrawFormNearValues>
            fieldName="amountIn"
            selected={token}
            handleSelect={handleSelect}
            className="border border-gray-4 rounded-xl"
            required
            min={
              minWithdrawalAmount != null
                ? {
                    value: formatTokenValue(
                      minWithdrawalAmount.amount,
                      minWithdrawalAmount.decimals
                    ),
                    message: "Amount is too low",
                  }
                : undefined
            }
            max={
              tokenInBalance != null
                ? {
                    value: formatTokenValue(
                      tokenInBalance.amount,
                      tokenInBalance.decimals
                    ),
                    message: "Insufficient balance",
                  }
                : undefined
            }
            errors={errors}
            balance={tokenInBalance}
            transitBalance={tokenInTransitBalance}
            register={register}
            usdAmount={
              tokenToWithdrawUsdAmount !== null && tokenToWithdrawUsdAmount > 0
                ? `~${formatUsdAmount(tokenToWithdrawUsdAmount)}`
                : null
            }
          />

          <MinWithdrawalAmount
            minWithdrawalAmount={minWithdrawalAmount}
            tokenOut={tokenOut}
          />

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
                      blockchainSelectItems[field.value]?.label ??
                      "Select network"
                    }
                    icon={
                      blockchainSelectItems[field.value]?.icon ?? <EmptyIcon />
                    }
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
                      field.value ===
                        Object.values(blockchainSelectItems)[0]?.value
                    }
                  />

                  <ModalSelectNetwork
                    token={token}
                    selectNetwork={onChangeNetwork}
                    selectedNetwork={blockchain}
                    isOpen={isNetworkModalOpen}
                    onClose={onCloseNetworkModal}
                    renderValueDetails={
                      showHotBalances
                        ? (address: string) => (
                            <HotBalance
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

            {showHotBalances && (
              <LongWithdrawWarning
                amountIn={parsedAmountIn}
                token={tokenOut}
                tokensUsdPriceData={tokensUsdPriceData}
                hotBalance={
                  blockchainSelectItems[tokenOut.chainName]?.hotBalance
                }
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
                          if (!validateAddress(value, formValues.blockchain)) {
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

            {blockchain === "xrpledger" && (
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
                          parseDestinationMemo(value, tokenOut.chainName) ==
                          null
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
            )}
          </Flex>

          {blockchain === "near" && (
            <Text
              as="label"
              size="1"
              weight="medium"
              color={errors.isFundsLooseConfirmed ? "red" : "gray"}
            >
              <Flex as="span" gap="2">
                <Checkbox
                  size="3"
                  {...fundsLooseConfirmedField}
                  value={undefined}
                  checked={fundsLooseConfirmedField.value}
                  onCheckedChange={fundsLooseConfirmedField.onChange}
                />
                I understand CEX addresses may cause fund loss or issues.
                <Tooltip
                  side="bottom"
                  align="center"
                  maxWidth="300px"
                  content="Many centralized exchanges (CEXs) don’t support third-party protocol withdrawals. Using a CEX address may result in lost or delayed funds. Use a self-custodial wallet instead."
                >
                  <Text
                    size="1"
                    color="gray"
                    as="span"
                    style={{
                      textDecoration: "underline",
                      textDecorationStyle: "dotted",
                    }}
                  >
                    Why?
                  </Text>
                </Tooltip>
              </Flex>
            </Text>
          )}

          <Flex justify="between" px="2">
            <Text size="1" weight="medium" color="gray">
              Received amount
            </Text>

            <Text size="1" weight="bold">
              {state.matches({ editing: "preparation" }) ? (
                <Skeleton>100.000000</Skeleton>
              ) : totalAmountReceived == null ? (
                "–"
              ) : (
                formatTokenValue(
                  totalAmountReceived.amount,
                  totalAmountReceived.decimals
                )
                // biome-ignore lint/nursery/useConsistentCurlyBraces: space is needed here
              )}{" "}
              {token.symbol}
            </Text>
          </Flex>

          <AuthGate
            renderHostAppLink={renderHostAppLink}
            shouldRender={isLoggedIn}
          >
            <ButtonCustom
              size="lg"
              disabled={state.matches("submitting") || noLiquidity}
              isLoading={state.matches("submitting")}
            >
              {getWithdrawButtonText(noLiquidity, insufficientTokenInAmount)}
            </ButtonCustom>
          </AuthGate>
        </Flex>
      </Form>

      <PreparationResult preparationOutput={state.context.preparationOutput} />
      {renderIntentCreationResult(intentCreationResult)}

      {intentRefs.length !== 0 && <Intents intentRefs={intentRefs} />}
    </Island>
  )
}

type TypeEqualityGuard<A, B> = Exclude<A, B> | Exclude<B, A> extends never
  ? true
  : never
const _typeCheck: TypeEqualityGuard<
  SupportedChainName,
  (typeof allBlockchains)[number]["value"]
> = true
