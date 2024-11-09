import { ExclamationTriangleIcon, PersonIcon } from "@radix-ui/react-icons"
import {
  Box,
  Button,
  Callout,
  Flex,
  Skeleton,
  Spinner,
  Text,
  TextField,
} from "@radix-ui/themes"
import { useSelector } from "@xstate/react"
import { providers } from "near-api-js"
import { Fragment, useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import type { ActorRefFrom, SnapshotFrom } from "xstate"
import { EmptyIcon } from "../../../../components/EmptyIcon"
import { Form } from "../../../../components/Form"
import { FieldComboInput } from "../../../../components/Form/FieldComboInput"
import { WithdrawIntentCard } from "../../../../components/IntentCard/WithdrawIntentCard"
import { NetworkIcon } from "../../../../components/Network/NetworkIcon"
import { Select } from "../../../../components/Select/Select"
import { useModalController } from "../../../../hooks"
import { useTokensStore } from "../../../../providers/TokensStoreProvider"
import { ModalType } from "../../../../stores/modalStore"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../../types/base"
import type { WithdrawWidgetProps } from "../../../../types/withdraw"
import { isBaseToken } from "../../../../utils"
import { assert } from "../../../../utils/assert"
import { formatTokenValue } from "../../../../utils/format"
import { parseUnits } from "../../../../utils/parse"
import { validateAddress } from "../../../../utils/validateAddress"
import type { intentStatusMachine } from "../../../machines/intentStatusMachine"
import type { withdrawUIMachine } from "../../../machines/withdrawUIMachine"
import {
  balanceSelector,
  renderIntentCreationResult,
} from "../../../swap/components/SwapForm"
import { usePublicKeyModalOpener } from "../../../swap/hooks/usePublicKeyModalOpener"
import { WithdrawUIMachineContext } from "../../WithdrawUIMachineContext"
import styles from "./styles.module.css"

export type WithdrawFormNearValues = {
  amountIn: string
  recipient: string
  blockchain: string
}

interface WithdrawFormProps extends WithdrawWidgetProps {}

export const WithdrawForm = ({
  userAddress,
  tokenList,
  sendNearTransaction,
}: WithdrawFormProps) => {
  const actorRef = WithdrawUIMachineContext.useActorRef()

  const formRef = WithdrawUIMachineContext.useSelector(
    (state) => state.children.withdrawFormRef
  )
  assert(formRef != null, "Form ref must be defined")

  const {
    state,
    depositedBalanceRef,
    intentCreationResult,
    intentRefs,
    nep141StorageRequired,
  } = WithdrawUIMachineContext.useSelector((state) => {
    return {
      state,
      depositedBalanceRef: state.children.depositedBalanceRef,
      intentCreationResult: state.context.intentCreationResult,
      intentRefs: state.context.intentRefs,
      nep141StorageRequired:
        state.context.nep141StorageOutput?.tag === "ok" &&
        state.context.nep141StorageOutput.value > 0n,
    }
  })

  const swapRef = useSelector(actorRef, (state) => state.children.swapRef)
  const publicKeyVerifierRef = useSelector(swapRef, (state) => {
    if (state) {
      return state.children.publicKeyVerifierRef
    }
  })
  usePublicKeyModalOpener(publicKeyVerifierRef)

  const totalAmountReceived = WithdrawUIMachineContext.useSelector(
    totalAmountReceivedSelector
  )

  useEffect(() => {
    if (userAddress != null) {
      actorRef.send({
        type: "LOGIN",
        params: { accountId: userAddress },
      })
    } else {
      actorRef.send({
        type: "LOGOUT",
      })
    }
  }, [userAddress, actorRef])

  const { token, blockchain, amountIn, recipient } = useSelector(
    formRef,
    (state) => {
      const { tokenOut } = state.context

      return {
        blockchain: tokenOut.chainName,
        token: state.context.tokenIn,
        amountIn: state.context.amount,
        recipient: state.context.recipient,
      }
    }
  )

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
    mode: "onTouched",
    reValidateMode: "onChange",
    values: {
      amountIn,
      recipient,
      blockchain,
    },
  })

  const { setModalType, data: modalSelectAssetsData } = useModalController<{
    modalType: ModalType
    token: BaseTokenInfo | UnifiedTokenInfo
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
  }, [modalSelectAssetsData?.token, actorRef, amountIn])

  useEffect(() => {
    const sub = watch(async (value, { name }) => {
      if (name === "amountIn") {
        const amount = value[name] ?? ""

        let parsedAmount = 0n
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

  return (
    <div className={styles.container}>
      <Flex direction={"column"} gap={"2"} className={styles.formWrapper}>
        <Form<WithdrawFormNearValues>
          handleSubmit={handleSubmit(() => {
            if (userAddress == null) {
              console.warn("No user address provided")
              return
            }

            actorRef.send({
              type: "submit",
              params: {
                userAddress,
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
              min={{
                value: formatTokenValue(1n, token.decimals),
                message: "Amount is too low",
              }}
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
                <TextField.Root
                  size={"3"}
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

                {errors.recipient && (
                  <Box px={"2"} asChild>
                    <Text size={"1"} color={"red"} weight={"medium"}>
                      {errors.recipient.message}
                    </Text>
                  </Box>
                )}

                {nep141StorageRequired && (
                  <Callout.Root size={"1"} color="red">
                    <Callout.Icon>
                      <ExclamationTriangleIcon />
                    </Callout.Icon>
                    <Callout.Text>
                      You need a small amount of this token in the withdrawal
                      address to complete the transaction. Please send a small
                      amount to the withdrawal address to proceed. We're working
                      on a permanent fix.
                    </Callout.Text>
                  </Callout.Root>
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
                  formatTokenValue(totalAmountReceived, token.decimals)
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
              disabled={state.matches("submitting")}
            >
              <span className={styles.buttonContent}>
                <Spinner loading={state.matches("submitting")} />
                <Text size="6">Withdraw</Text>
              </span>
            </Button>
          </Flex>
        </Form>

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

function renderBlockchainLabel(chainName: string): string {
  const blockchain = allBlockchains.find((a) => a.value === chainName)
  if (blockchain != null) {
    return blockchain.label
  }
  console.warn(`Unknown blockchain: ${chainName}`)
  return chainName
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

function totalAmountReceivedSelector(
  state: SnapshotFrom<typeof withdrawUIMachine>
): bigint | null {
  if (state.context.withdrawalSpec == null) {
    return null
  }
  return (
    (state.context.quote?.totalAmountOut ?? 0n) +
    state.context.withdrawalSpec.directWithdrawalAmount
  )
}
