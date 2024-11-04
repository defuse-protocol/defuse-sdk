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
import { Fragment, useEffect } from "react"
import { useForm } from "react-hook-form"
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
}

interface WithdrawFormProps extends WithdrawWidgetProps {}

export const WithdrawForm = ({
  accountId,
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
        state.context.nep141StorageOutput?.result === "NEED_NEP141_STORAGE",
    }
  })

  const totalAmountReceived = WithdrawUIMachineContext.useSelector(
    totalAmountReceivedSelector
  )

  useEffect(() => {
    if (accountId != null) {
      actorRef.send({
        type: "LOGIN",
        params: { accountId },
      })
    } else {
      actorRef.send({
        type: "LOGOUT",
      })
    }
  }, [accountId, actorRef])

  useEffect(() => {
    const s = actorRef.subscribe((state) => {
      console.log("SwapUIMachine", JSON.stringify(state.value), state.context)
    })
    return () => s.unsubscribe()
  }, [actorRef])

  const { token, blockchain, amount, recipient } = useSelector(
    formRef,
    (state) => {
      const { tokenOut } = state.context

      return {
        blockchain: tokenOut.chainName,
        token: state.context.tokenIn,
        amount: state.context.amount,
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
    setValue,
    watch,
    formState: { errors },
  } = useForm<WithdrawFormNearValues>({
    reValidateMode: "onSubmit",
    values: {
      amountIn: amount,
      recipient: recipient,
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
      selectToken: token,
      balances: depositedBalanceRef?.getSnapshot().context.balances,
    })
  }

  /**
   * This is ModalSelectAssets "callback"
   */
  useEffect(() => {
    if (modalSelectAssetsData?.token) {
      let parsedAmount = 0n
      try {
        parsedAmount = parseUnits(amount, token.decimals)
      } catch {}

      actorRef.send({
        type: "WITHDRAW_FORM.UPDATE_TOKEN",
        params: {
          token: modalSelectAssetsData.token,
          parsedAmount: parsedAmount,
        },
      })
    }
  }, [modalSelectAssetsData, actorRef, token.decimals, amount])

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
            if (accountId == null) {
              console.warn("No user address provided")
              return
            }

            actorRef.send({
              type: "submit",
              params: {
                userAddress: accountId,
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
            <Select
              name={"blockchain"}
              options={blockchainSelectItems}
              placeholder={{
                label: "Select network",
                icon: <EmptyIcon />,
              }}
              fullWidth
              value={blockchain}
              onChange={(value) => {
                actorRef.send({
                  type: "WITHDRAW_FORM.UPDATE_BLOCKCHAIN",
                  params: { blockchain: value },
                })
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

            {nep141StorageRequired && (
              <Callout.Root size={"1"} color="red">
                <Callout.Icon>
                  <ExclamationTriangleIcon />
                </Callout.Icon>
                <Callout.Text>
                  Withdrawal isn’t possible right now because this account
                  doesn’t have the necessary storage for the token. To resolve
                  this, you can send a small amount of the token to the account.
                  We’re working on a long-term solution.
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
