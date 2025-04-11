import {
  ExclamationTriangleIcon,
  InfoCircledIcon,
  MagicWandIcon,
  PersonIcon,
} from "@radix-ui/react-icons"
import {
  Box,
  Callout,
  Flex,
  IconButton,
  Skeleton,
  Text,
  TextField,
} from "@radix-ui/themes"
import { useSelector } from "@xstate/react"
import { type ReactNode, useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTokensUsdPrices } from "src/hooks/useTokensUsdPrices"
import { formatTokenValue, formatUsdAmount } from "src/utils/format"
import getTokenUsdPrice from "src/utils/getTokenUsdPrice"
import type { ActorRefFrom } from "xstate"
import { AuthGate } from "../../../../components/AuthGate"
import { ButtonCustom } from "../../../../components/Button/ButtonCustom"
import { EmptyIcon } from "../../../../components/EmptyIcon"
import { Form } from "../../../../components/Form"
import { FieldComboInput } from "../../../../components/Form/FieldComboInput"
import { WithdrawIntentCard } from "../../../../components/IntentCard/WithdrawIntentCard"
import { Island } from "../../../../components/Island"
import { IslandHeader } from "../../../../components/IslandHeader"
import { Select } from "../../../../components/Select/Select"
import { nearClient } from "../../../../constants/nearClient"
import { useModalController } from "../../../../hooks/useModalController"
import { logger } from "../../../../logger"
import { useTokensStore } from "../../../../providers/TokensStoreProvider"
import { ModalType } from "../../../../stores/modalStore"
import type {
  BaseTokenInfo,
  SupportedChainName,
  TokenValue,
  UnifiedTokenInfo,
} from "../../../../types/base"
import type { WithdrawWidgetProps } from "../../../../types/withdraw"
import { parseUnits } from "../../../../utils/parse"
import { getTokenMaxDecimals } from "../../../../utils/tokenUtils"
import { validateAddress } from "../../../../utils/validateAddress"
import {
  balanceSelector,
  transitBalanceSelector,
} from "../../../machines/depositedBalanceMachine"
import type { intentStatusMachine } from "../../../machines/intentStatusMachine"
import { getPOABridgeInfo } from "../../../machines/poaBridgeInfoActor"
import type { PreparationOutput } from "../../../machines/prepareWithdrawActor"
import { parseDestinationMemo } from "../../../machines/withdrawFormReducer"
import { renderIntentCreationResult } from "../../../swap/components/SwapForm"
import { usePublicKeyModalOpener } from "../../../swap/hooks/usePublicKeyModalOpener"
import { WithdrawUIMachineContext } from "../../WithdrawUIMachineContext"
import { HotBalance } from "./HotBalance/HotBalance"
import { LongWithdrawWarning } from "./LongWithdrawWarning"
import type { allBlockchains } from "./constants"
import { useTokenBalances } from "./hooks/useTokenBalances"
import {
  isLiquidityUnavailableSelector,
  isUnsufficientTokenInAmount,
  totalAmountReceivedSelector,
} from "./selectors"
import {
  chainTypeSatisfiesChainName,
  getBlockchainSelectItems,
  shouldShowHotBalance,
  truncateUserAddress,
} from "./utils"

export type WithdrawFormNearValues = {
  amountIn: string
  recipient: string
  blockchain: SupportedChainName
  destinationMemo?: string
}

type WithdrawFormProps = WithdrawWidgetProps

export const WithdrawForm = ({
  userAddress,
  chainType,
  tokenList,
  sendNearTransaction,
  renderHostAppLink,
}: WithdrawFormProps) => {
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

  const { setModalType, data: modalSelectAssetsData } = useModalController<{
    modalType: ModalType
    token: BaseTokenInfo | UnifiedTokenInfo | undefined
  }>(ModalType.MODAL_SELECT_ASSETS)

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
      }
    })
    return () => {
      sub.unsubscribe()
    }
  }, [watch, actorRef, token])

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

  const balances = useTokenBalances(token, hasAnyBalance)

  const blockchainSelectItems = getBlockchainSelectItems(
    token,
    balances,
    tokensUsdPriceData
  )

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

          {renderMinWithdrawalAmount(minWithdrawalAmount, tokenOut)}

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
              render={({ field }) => {
                return (
                  <Select
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    disabled={Object.keys(blockchainSelectItems).length === 1}
                    options={blockchainSelectItems}
                    placeholder={{
                      label: "Select network",
                      icon: <EmptyIcon />,
                    }}
                    hint={
                      <Select.Hint>
                        {Object.keys(blockchainSelectItems).length === 1
                          ? "This network only"
                          : "Network"}
                      </Select.Hint>
                    }
                    renderValueDetails={
                      showHotBalances
                        ? (address: string) => (
                            <HotBalance
                              hotBalance={
                                blockchainSelectItems[address]?.hotBalance
                              }
                            />
                          )
                        : undefined
                    }
                  />
                )
              }}
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
                      title={`Autofill with your address ${truncateUserAddress(userAddress)}`}
                      aria-label={`Autofill with your address ${truncateUserAddress(userAddress)}`}
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
              {renderWithdrawButtonText(noLiquidity, insufficientTokenInAmount)}
            </ButtonCustom>
          </AuthGate>
        </Flex>
      </Form>

      {renderPreparationResult(state.context.preparationOutput)}
      {renderIntentCreationResult(intentCreationResult)}

      {intentRefs.length !== 0 && <Intents intentRefs={intentRefs} />}
    </Island>
  )
}

function renderWithdrawButtonText(
  noLiquidity: boolean,
  insufficientTokenInAmount: boolean
) {
  if (noLiquidity) return "No liquidity providers"
  if (insufficientTokenInAmount) return "Insufficient amount"
  return "Withdraw"
}

type TypeEqualityGuard<A, B> = Exclude<A, B> | Exclude<B, A> extends never
  ? true
  : never
const _typeCheck: TypeEqualityGuard<
  SupportedChainName,
  (typeof allBlockchains)[number]["value"]
> = true

function renderMinWithdrawalAmount(
  minWithdrawalAmount: TokenValue | null,
  tokenOut: BaseTokenInfo
) {
  return (
    minWithdrawalAmount != null &&
    minWithdrawalAmount.amount > 1n && (
      <Callout.Root size="1" color="gray" variant="surface">
        <Callout.Icon>
          <InfoCircledIcon />
        </Callout.Icon>
        <Callout.Text>
          {/* biome-ignore lint/nursery/useConsistentCurlyBraces: space is needed here */}
          Minimal amount to withdraw is{" "}
          <Text size="1" weight="bold">
            {formatTokenValue(
              minWithdrawalAmount.amount,
              minWithdrawalAmount.decimals
              // biome-ignore lint/nursery/useConsistentCurlyBraces: space is needed here
            )}{" "}
            {tokenOut.symbol}
          </Text>
        </Callout.Text>
      </Callout.Root>
    )
  )
}

function renderPreparationResult(preparationOutput: PreparationOutput | null) {
  if (preparationOutput?.tag !== "err") return null

  let content: ReactNode = null
  const err = preparationOutput.value
  const val = err.reason

  switch (val) {
    case "ERR_NEP141_STORAGE":
      content = val
      break
    case "ERR_CANNOT_FETCH_POA_BRIDGE_INFO":
      content = "Cannot fetch POA Bridge info"
      break
    case "ERR_BALANCE_INSUFFICIENT":
      // Don't duplicate error messages, this should be handled by input validation
      break
    case "ERR_AMOUNT_TOO_LOW":
      content = `Need ${formatTokenValue(err.minWithdrawalAmount - err.receivedAmount, err.token.decimals)} ${err.token.symbol} more to withdraw`
      break
    case "NO_QUOTES":
    case "INSUFFICIENT_AMOUNT":
      // Don't duplicate error messages, message should be displayed in the submit button
      break
    case "ERR_CANNOT_FETCH_QUOTE":
      content = "Cannot fetch quote"
      break
    case "ERR_BALANCE_FETCH":
    case "ERR_BALANCE_MISSING":
      content = "Cannot fetch balance"
      break
    default:
      val satisfies never
      content = val
  }

  if (content == null) return null

  return (
    <Callout.Root size="1" color="red">
      <Callout.Icon>
        <ExclamationTriangleIcon />
      </Callout.Icon>
      <Callout.Text>{content}</Callout.Text>
    </Callout.Root>
  )
}

function Intents({
  intentRefs,
}: { intentRefs: ActorRefFrom<typeof intentStatusMachine>[] }) {
  return (
    <div>
      {intentRefs.map((intentRef) => (
        <WithdrawIntentCard
          key={intentRef.id}
          intentStatusActorRef={intentRef}
        />
      ))}
    </div>
  )
}
