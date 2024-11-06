import { ExclamationTriangleIcon, PersonIcon } from "@radix-ui/react-icons"
import {
  Button,
  Callout,
  Flex,
  Skeleton,
  Spinner,
  Text,
} from "@radix-ui/themes"
import { useSelector } from "@xstate/react"
import { parseUnits } from "ethers"
import { providers } from "near-api-js"
import { Fragment, useEffect, useState } from "react"
import {
  Controller,
  type FieldErrors,
  type Resolver,
  useForm,
} from "react-hook-form"
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
import { validateAddress } from "../../../../utils/validateAddress"
import type { intentStatusMachine } from "../../../machines/intentStatusMachine"
import type { withdrawUIMachine } from "../../../machines/withdrawUIMachine"
import {
  balanceSelector,
  renderIntentCreationResult,
} from "../../../swap/components/SwapForm"
import { WithdrawUIMachineContext } from "../../WithdrawUIMachineContext"
import styles from "./styles.module.css"

export type WithdrawFormNearValues = {
  amountIn: string
  recipient: string
  blockchain: string
}

interface WithdrawFormProps extends WithdrawWidgetProps {}

const resolver: Resolver<WithdrawFormNearValues> = (values) => {
  const errors: FieldErrors<WithdrawFormNearValues> = {}

  if (!validateAddress(values.recipient, values.blockchain)) {
    errors.recipient = {
      type: "manual",
      message: "Invalid address for the selected blockchain",
    }
  }
  return { values, errors }
}

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

  useEffect(() => {
    const s = actorRef.subscribe((state) => {
      console.log("SwapUIMachine", JSON.stringify(state.value), state.context)
    })
    return () => s.unsubscribe()
  }, [actorRef])

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
    setValue,
    watch,
    formState: { errors },
  } = useForm<WithdrawFormNearValues>({
    mode: "onTouched",
    reValidateMode: "onChange",
    values: {
      amountIn,
      recipient,
      blockchain,
    },
    resolver,
  })

  const { setModalType, data: modalSelectAssetsData } = useModalController<{
    modalType: ModalType
    token: BaseTokenInfo | UnifiedTokenInfo
  }>(ModalType.MODAL_SELECT_ASSETS, "token")

  const updateTokens = useTokensStore((state) => state.updateTokens)

  // This hack to avoid unnecessary calls of ModalSelectAssets "callback"
  const [tokenSelectModalIsOpen, setIsTokenSelectModalOpen] = useState(false)

  const handleSelect = () => {
    updateTokens(tokenList)
    setModalType(ModalType.MODAL_SELECT_ASSETS, {
      fieldName: "tokenIn",
      selectToken: token,
      balances: depositedBalanceRef?.getSnapshot().context.balances,
    })
    setIsTokenSelectModalOpen(true)
  }

  /**
   * This is ModalSelectAssets "callback"
   */
  useEffect(() => {
    if (tokenSelectModalIsOpen && modalSelectAssetsData?.token) {
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
      setIsTokenSelectModalOpen(false)
    }
  }, [tokenSelectModalIsOpen, modalSelectAssetsData, actorRef, amountIn])

  useEffect(() => {
    // When values are set externally, they trigger "watch" callback too.
    // In order to avoid, unnecessary state updates need to check if the form is changed by user
    const sub = watch(async (value, { type, name }) => {
      if (type === "change" && name != null) {
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
      }
    })
    return () => {
      sub.unsubscribe()
    }
  }, [watch, actorRef, token.decimals])

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
          <div className={styles.selectWrapper}>
            <Controller
              name="blockchain"
              control={control}
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
          </div>
          <FieldComboInput<WithdrawFormNearValues>
            fieldName="amountIn"
            selected={token}
            handleSelect={() => {
              handleSelect()
            }}
            className="border rounded-t-xl"
            required="This field is required"
            errors={errors}
            balance={tokenInBalance}
          />
          <Flex direction={"column"} gap={"2"}>
            <Flex
              gap="2"
              align="center"
              justify="between"
              className={styles.input}
            >
              <input
                {...register("recipient")}
                placeholder="Enter wallet address"
              />
              <PersonIcon
                width={20}
                height={20}
                className={styles.personIcon}
                onClick={() => setValue("recipient", "")}
              />
            </Flex>
            {errors.recipient && (
              <Text color="red">{errors.recipient.message}</Text>
            )}
            {nep141StorageRequired && (
              <Callout.Root size={"1"} color="red">
                <Callout.Icon>
                  <ExclamationTriangleIcon />
                </Callout.Icon>
                <Callout.Text>
                  You need a small amount of this token in the withdrawal
                  address to complete the transaction. Please send a small
                  amount to the withdrawal address to proceed. We're working on
                  a permanent fix.
                </Callout.Text>
              </Callout.Root>
            )}
          </Flex>

          <Flex
            gap="2"
            align="center"
            justify="end"
            className={styles.receivedAmount}
          >
            <Text>Received amount</Text>

            <Text className={styles.receivedAmountValue}>
              {state.matches({ editing: "preparation" }) ? (
                <Skeleton>100.000000</Skeleton>
              ) : totalAmountReceived == null ? (
                "–"
              ) : (
                formatTokenValue(totalAmountReceived, token.decimals)
              )}{" "}
              {token.symbol} @ {renderBlockchainLabel(blockchain)}
            </Text>
          </Flex>
          <div className={styles.buttonGroup}>
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
          </div>
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
    value: "near",
  },
  {
    label: "Ethereum",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/ethereum.svg"
        chainName="Ethereum"
      />
    ),
    value: "eth",
  },
  {
    label: "Base",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/base.svg"
        chainName="Base"
      />
    ),
    value: "base",
  },
  {
    label: "Arbitrum",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/arbitrum.svg"
        chainName="Arbitrum"
      />
    ),
    value: "arbitrum",
  },
  {
    label: "Bitcoin",
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/btc.svg"
        chainName="Bitcoin"
      />
    ),
    value: "bitcoin",
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
