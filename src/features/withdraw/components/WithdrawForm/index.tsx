import { PersonIcon } from "@radix-ui/react-icons"
import { Button, Flex, Spinner, Text } from "@radix-ui/themes"
import { useSelector } from "@xstate/react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { EmptyIcon } from "../../../../components/EmptyIcon"
import { Form } from "../../../../components/Form"
import { FieldComboInput } from "../../../../components/Form/FieldComboInput"
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
import { balanceSelector } from "../../../swap/components/SwapForm"
import { SwapUIMachineContext } from "../../../swap/components/SwapUIMachineProvider"
import styles from "./styles.module.css"

export type WithdrawFormNearValues = {
  amountIn: string
  recipient: string
}

interface WithdrawFormProps extends WithdrawWidgetProps {
  amountOutFormatted: string
}

export const WithdrawForm = ({
  accountId,
  tokenList,
  amountOutFormatted,
}: WithdrawFormProps) => {
  const actorRef = SwapUIMachineContext.useActorRef()

  const depositedBalanceRef = useSelector(
    actorRef,
    (state) => state.children.depositedBalanceRef
  )

  useEffect(() => {
    console.log({ accountId })
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

  const { tokenIn, tokenOut, blockchainView } =
    SwapUIMachineContext.useSelector((state) => {
      const { tokenIn, tokenOut } = state.context.formValues

      // Sanity check
      assert(isBaseToken(tokenOut), "Token out must be base token")

      return {
        blockchainView: tokenOut.chainName,
        tokenIn,
        tokenOut,
      }
    })

  const tokenInBalance = useSelector(
    depositedBalanceRef,
    balanceSelector(tokenIn)
  )

  const {
    handleSubmit,
    register,
    setValue,
    watch,
    formState: { errors },
  } = useForm<WithdrawFormNearValues>({
    reValidateMode: "onSubmit",
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
      selectToken: tokenIn,
      balances: depositedBalanceRef?.getSnapshot().context.balances,
    })
  }

  /**
   * This is ModalSelectAssets "callback"
   */
  useEffect(() => {
    if (modalSelectAssetsData?.token) {
      const nextTokenIn = modalSelectAssetsData.token

      const tokenOut = actorRef.getSnapshot().context.formValues.tokenOut
      // Sanity check
      assert(isBaseToken(tokenOut), "Token out must be base token")

      const selectedChainName = tokenOut.chainName

      const nextTokenOut = isBaseToken(nextTokenIn)
        ? nextTokenIn
        : (nextTokenIn.groupedTokens.find(
            (t) => t.chainName === selectedChainName
          ) ??
          // biome-ignore lint/style/noNonNullAssertion: groupedTokens is not empty
          nextTokenIn.groupedTokens[0]!)

      actorRef.send({
        type: "input",
        params: {
          tokenIn: nextTokenIn,
          tokenOut: nextTokenOut,
        },
      })
    }
  }, [modalSelectAssetsData, actorRef])

  useEffect(() => {
    // When values are set externally, they trigger "watch" callback too.
    // In order to avoid, unnecessary state updates need to check if the form is changed by user
    const sub = watch(async (value, { type, name }) => {
      if (type === "change" && name != null) {
        if (name === "amountIn") {
          actorRef.send({
            type: "input",
            params: { [name]: value[name] },
          })
        }
      }
    })
    return () => {
      sub.unsubscribe()
    }
  }, [watch, actorRef])

  const availableBlockchains = isBaseToken(tokenIn)
    ? [tokenIn.chainName]
    : tokenIn.groupedTokens.map((token) => token.chainName)

  const blockchainSelectItems = Object.fromEntries(
    allBlockchains
      .filter((blockchain) => availableBlockchains.includes(blockchain.value))
      .map((a) => [a.value, a])
  )

  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <Form<WithdrawFormNearValues>
          handleSubmit={handleSubmit(() => {
            // TODO: Call withdraw fn at withdraw machine
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
              value={blockchainView}
              onChange={(value) => {
                if (value === "") {
                  /**
                   * For some reason, Select emits empty string,
                   * when the value is set to a value that is not in the list (?).
                   */
                  return
                }

                // Double check that the value is correct
                assert(
                  availableBlockchains.includes(value),
                  `Unexpected blockchain value "${value}"`
                )

                const tokenOut = isBaseToken(tokenIn)
                  ? tokenIn
                  : (tokenIn.groupedTokens.find((t) => t.chainName === value) ??
                    // biome-ignore lint/style/noNonNullAssertion: groupedTokens is not empty
                    tokenIn.groupedTokens[0]!)

                actorRef.send({
                  type: "input",
                  params: { tokenOut },
                })
              }}
            />
          </div>
          <FieldComboInput<WithdrawFormNearValues>
            fieldName="amountIn"
            selected={tokenIn}
            handleSelect={() => {
              handleSelect()
            }}
            className="border rounded-t-xl"
            required="This field is required"
            errors={errors}
            balance={tokenInBalance}
          />
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
          <Flex
            gap="2"
            align="center"
            justify="end"
            className={styles.receivedAmount}
          >
            <Text>Received amount</Text>
            <Text className={styles.receivedAmountValue}>
              {formatTokenValue(amountOutFormatted, tokenOut.decimals)}{" "}
              {tokenOut.symbol} @ {renderBlockchainLabel(tokenOut.chainName)}
            </Text>
          </Flex>
          <div className={styles.buttonGroup}>
            <Button
              variant="classic"
              size="3"
              radius="large"
              className={`${styles.button}`}
              color="orange"
              disabled={!watch("amountIn") || !watch("recipient")}
            >
              <span className={styles.buttonContent}>
                <Spinner loading={false} />
                <Text size="6">Withdraw</Text>
              </span>
            </Button>
          </div>
        </Form>
      </div>
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
    console.warn(`Unknown blockchain: ${chainName}`)
    return blockchain.label
  }
  return chainName
}
