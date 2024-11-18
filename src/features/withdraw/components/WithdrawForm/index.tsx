import {
  ExclamationTriangleIcon,
  InfoCircledIcon,
  MagicWandIcon,
  PersonIcon,
} from "@radix-ui/react-icons"
import {
  Box,
  Button,
  Callout,
  Flex,
  IconButton,
  Skeleton,
  Spinner,
  Text,
  TextField,
} from "@radix-ui/themes"
import { useSelector } from "@xstate/react"
import { providers } from "near-api-js"
import { Fragment, type ReactNode, useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import type { ActorRefFrom } from "xstate"
import { EmptyIcon } from "../../../../components/EmptyIcon"
import { Form } from "../../../../components/Form"
import { FieldComboInput } from "../../../../components/Form/FieldComboInput"
import { WithdrawIntentCard } from "../../../../components/IntentCard/WithdrawIntentCard"
import { NetworkIcon } from "../../../../components/Network/NetworkIcon"
import { Select } from "../../../../components/Select/Select"
import { useModalController } from "../../../../hooks"
import { useTokensStore } from "../../../../providers/TokensStoreProvider"
import { ModalType } from "../../../../stores/modalStore"
import { ChainType } from "../../../../types"
import type {
  BaseTokenInfo,
  SupportedChainName,
  UnifiedTokenInfo,
} from "../../../../types/base"
import type { WithdrawWidgetProps } from "../../../../types/withdraw"
import { isBaseToken } from "../../../../utils"
import { formatTokenValue } from "../../../../utils/format"
import { parseUnits } from "../../../../utils/parse"
import { validateAddress } from "../../../../utils/validateAddress"
import type { intentStatusMachine } from "../../../machines/intentStatusMachine"
import { getPOABridgeInfo } from "../../../machines/poaBridgeInfoActor"
import type { PreparationOutput } from "../../../machines/prepareWithdrawActor"
import {
  balanceSelector,
  renderIntentCreationResult,
} from "../../../swap/components/SwapForm"
import { usePublicKeyModalOpener } from "../../../swap/hooks/usePublicKeyModalOpener"
import { WithdrawUIMachineContext } from "../../WithdrawUIMachineContext"
import {
  isLiquidityUnavailableSelector,
  totalAmountReceivedSelector,
} from "./selectors"
import styles from "./styles.module.css"

export type WithdrawFormNearValues = {
  amountIn: string
  recipient: string
  blockchain: string
}

type WithdrawFormProps = WithdrawWidgetProps

export const WithdrawForm = ({
  userAddress,
  chainType,
  tokenList,
  sendNearTransaction,
}: WithdrawFormProps) => {
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
      totalAmountReceived: totalAmountReceivedSelector(state),
    }
  })

  const publicKeyVerifierRef = useSelector(swapRef, (state) => {
    if (state) {
      return state.children.publicKeyVerifierRef
    }
  })
  usePublicKeyModalOpener(publicKeyVerifierRef)

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

  const { token, tokenOut, blockchain, amountIn, recipient } = useSelector(
    formRef,
    (state) => {
      const { tokenOut } = state.context

      return {
        blockchain: tokenOut.chainName,
        token: state.context.tokenIn,
        tokenOut: state.context.tokenOut,
        amountIn: state.context.amount,
        recipient: state.context.recipient,
      }
    }
  )

  const minWithdrawalAmount = useSelector(poaBridgeInfoRef, (state) => {
    const bridgedTokenInfo = getPOABridgeInfo(state, tokenOut)
    return bridgedTokenInfo == null ? null : bridgedTokenInfo.minWithdrawal
  })

  const tokenInBalance = useSelector(
    depositedBalanceRef,
    balanceSelector(token)
  )

  const {
    handleSubmit,
    register,
    control,
    watch,
    formState: { errors },
    setValue,
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
  }>(ModalType.MODAL_SELECT_ASSETS, "token")

  const updateTokens = useTokensStore((state) => state.updateTokens)

  const handleSelect = () => {
    updateTokens(tokenList)
    setModalType(ModalType.MODAL_SELECT_ASSETS, {
      fieldName: "tokenIn",
      selectToken: undefined,
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
      let parsedAmount = 0n
      try {
        parsedAmount = parseUnits(amountIn, token.decimals)
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

        let parsedAmount: bigint | null = null
        try {
          parsedAmount = parseUnits(amount, token.decimals)
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
  }, [watch, actorRef, token.decimals])

  useEffect(() => {
    const sub = actorRef.on("INTENT_PUBLISHED", () => {
      setValue("amountIn", "")
    })

    return () => {
      sub.unsubscribe()
    }
  }, [actorRef, setValue])

  const availableBlockchains = isBaseToken(token)
    ? [token.chainName]
    : token.groupedTokens.map((token) => token.chainName)

  const blockchainSelectItems = Object.fromEntries(
    allBlockchains
      .filter((blockchain) => availableBlockchains.includes(blockchain.value))
      .map((a) => [a.value, a])
  )

  const isChainTypeSatisfiesChainName = chainTypeSatisfiesChainName(
    chainType,
    tokenOut.chainName
  )

  return (
    <div className={styles.container}>
      <Flex direction={"column"} gap={"2"} className={styles.formWrapper}>
        <Form<WithdrawFormNearValues>
          handleSubmit={handleSubmit(() => {
            if (userAddress == null || chainType == null) {
              console.warn("No user address provided")
              return
            }

            actorRef.send({
              type: "submit",
              params: {
                userAddress,
                userChainType: chainType,
                nearClient: new providers.JsonRpcProvider({
                  url: "https://nearrpc.aurora.dev",
                }),
                sendNearTransaction: sendNearTransaction,
              },
            })
          })}
          register={register}
        >
          <Flex direction={"column"} gap={"5"}>
            <FieldComboInput<WithdrawFormNearValues>
              fieldName="amountIn"
              selected={token}
              handleSelect={() => {
                handleSelect()
              }}
              className="border rounded-xl"
              required
              min={
                minWithdrawalAmount != null
                  ? {
                      value: formatTokenValue(
                        minWithdrawalAmount,
                        token.decimals
                      ),
                      message: "Amount is too low",
                    }
                  : undefined
              }
              max={
                tokenInBalance != null
                  ? {
                      value: formatTokenValue(tokenInBalance, token.decimals),
                      message: "Insufficient balance",
                    }
                  : undefined
              }
              errors={errors}
              balance={tokenInBalance}
              register={register}
            />

            {renderMinWithdrawalAmount(minWithdrawalAmount, tokenOut)}

            <Flex direction={"column"} gap={"2"}>
              <Box px={"2"} asChild>
                <Text size={"1"} weight={"bold"}>
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
                      fullWidth
                    />
                  )
                }}
              />

              <Flex direction={"column"} gap={"1"}>
                <Flex gap={"2"} align={"center"}>
                  <Box asChild flexGrow={"1"}>
                    <TextField.Root
                      size={"3"}
                      {...register("recipient", {
                        validate: {
                          pattern: (value, formValues) => {
                            if (
                              !validateAddress(value, formValues.blockchain)
                            ) {
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
                        type={"button"}
                        onClick={() => {
                          setValue("recipient", userAddress, {
                            shouldValidate: true,
                          })
                        }}
                        variant={"outline"}
                        size={"3"}
                        title={`Autofill with your address ${truncateUserAddress(userAddress)}`}
                        aria-label={`Autofill with your address ${truncateUserAddress(userAddress)}`}
                      >
                        <MagicWandIcon />
                      </IconButton>
                    )}
                </Flex>

                {errors.recipient && (
                  <Box px={"2"} asChild>
                    <Text size={"1"} color={"red"} weight={"medium"}>
                      {errors.recipient.message}
                    </Text>
                  </Box>
                )}
              </Flex>
            </Flex>

            <Flex justify={"between"} px={"2"}>
              <Text size={"1"} weight={"medium"} color={"gray"}>
                Received amount
              </Text>

              <Text size={"1"} weight={"bold"}>
                {state.matches({ editing: "preparation" }) ? (
                  <Skeleton>100.000000</Skeleton>
                ) : totalAmountReceived == null ? (
                  "–"
                ) : (
                  formatTokenValue(totalAmountReceived, tokenOut.decimals)
                )}{" "}
                {token.symbol}
              </Text>
            </Flex>

            <Button
              variant="classic"
              size="3"
              radius="large"
              className={`${styles.button}`}
              color="orange"
              disabled={state.matches("submitting") || !!noLiquidity}
            >
              {noLiquidity ? (
                "No liquidity providers"
              ) : (
                <span className={styles.buttonContent}>
                  <Spinner loading={state.matches("submitting")} />
                  <Text size="6">Withdraw</Text>
                </span>
              )}
            </Button>
          </Flex>
        </Form>

        {renderPreparationResult(state.context.preparationOutput)}
        {renderIntentCreationResult(intentCreationResult)}

        <Intents intentRefs={intentRefs} />
      </Flex>
    </div>
  )
}

const allBlockchains = [
  {
    label: "Near",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/near_dark.svg"
        chainName="Near"
      />
    ),
    value: "near" as const,
  },
  {
    label: "Ethereum",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/ethereum.svg"
        chainName="Ethereum"
      />
    ),
    value: "eth" as const,
  },
  {
    label: "Base",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/base.svg"
        chainName="Base"
      />
    ),
    value: "base" as const,
  },
  {
    label: "Arbitrum",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/arbitrum.svg"
        chainName="Arbitrum"
      />
    ),
    value: "arbitrum" as const,
  },
  {
    label: "Bitcoin",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/btc.svg"
        chainName="Bitcoin"
      />
    ),
    value: "bitcoin" as const,
  },
]

function renderMinWithdrawalAmount(
  minWithdrawalAmount: bigint | null,
  tokenOut: BaseTokenInfo
) {
  return (
    minWithdrawalAmount != null &&
    minWithdrawalAmount > 1n && (
      <Callout.Root size={"1"} color="gray" variant="surface">
        <Callout.Icon>
          <InfoCircledIcon />
        </Callout.Icon>
        <Callout.Text>
          Minimal amount to withdraw is{" "}
          <Text size={"1"} weight={"bold"}>
            {formatTokenValue(minWithdrawalAmount, tokenOut.decimals)}{" "}
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
    case "ERR_CANNOT_FETCH_QUOTE":
    case "ERR_EMPTY_QUOTE":
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
    <Callout.Root size={"1"} color="red">
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
      {intentRefs.map((intentRef) => {
        return (
          <Fragment key={intentRef.id}>
            <WithdrawIntentCard intentStatusActorRef={intentRef} />
          </Fragment>
        )
      })}
    </div>
  )
}

function chainTypeSatisfiesChainName(
  chainType: ChainType | undefined,
  chainName: SupportedChainName
) {
  if (chainType == null) return false

  switch (true) {
    case chainType === ChainType.Near && chainName === "near":
    case chainType === ChainType.EVM && chainName === "eth":
    case chainType === ChainType.EVM && chainName === "arbitrum":
    case chainType === ChainType.EVM && chainName === "base":
      return true
  }

  return false
}

function truncateUserAddress(hash: string) {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}
