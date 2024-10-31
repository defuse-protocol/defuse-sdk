import { PersonIcon } from "@radix-ui/react-icons"
import { Button, Flex, Spinner, Text } from "@radix-ui/themes"
import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { EmptyIcon } from "../../../../components/EmptyIcon"
import { Form } from "../../../../components/Form"
import { FieldComboInput } from "../../../../components/Form/FieldComboInput"
import { NetworkIcon } from "../../../../components/Network/NetworkIcon"
import { Select } from "../../../../components/Select/Select"
import { useModalController, useShortAccountId } from "../../../../hooks"
import { useTokensStore } from "../../../../providers/TokensStoreProvider"
import { ModalType } from "../../../../stores/modalStore"
import { BlockchainEnum, type SwappableToken } from "../../../../types"
import type { BaseTokenInfo } from "../../../../types/base"
import type { WithdrawWidgetProps } from "../../../../types/withdraw"
import styles from "./styles.module.css"

export type WithdrawFormNearValues = {
  tokenIn: SwappableToken
  amountIn: string
  accountId: string
  recipient: string
  blockchain: string
}

export const WithdrawForm = ({
  accountId,
  tokenList,
  signMessage,
}: WithdrawWidgetProps) => {
  const {
    handleSubmit,
    register,
    setValue,
    control,
    watch,
    formState: { errors },
  } = useForm<WithdrawFormNearValues>({ reValidateMode: "onSubmit" })
  const { setModalType, data } = useModalController<{
    modalType: ModalType
    token: BaseTokenInfo
  }>(ModalType.MODAL_SELECT_ASSETS, "token")
  const { updateTokens, data: tokens } = useTokensStore((state) => state)
  const [selectTokenIn, setSelectTokenIn] = useState<SwappableToken>(
    // biome-ignore lint/style/noNonNullAssertion: tokenList[0] is guaranteed to be defined
    tokenList[0]!
  )
  const [errorSelectTokenIn, setErrorSelectTokenIn] = useState("")
  const { shortAccountId } = useShortAccountId(accountId)

  const handleSelect = () => {
    setModalType(ModalType.MODAL_SELECT_ASSETS, {
      fieldName: "tokenIn",
      selectToken: selectTokenIn,
    })
  }

  useEffect(() => {
    if (data?.token) {
      setSelectTokenIn(data.token)
      setValue("tokenIn", data.token)
    }
  }, [data, setValue])

  useEffect(() => {
    if (tokenList) {
      updateTokens(tokenList)
    }
  }, [tokenList, updateTokens])

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
            <Controller
              name="blockchain"
              control={control}
              render={({ field }) => (
                <Select
                  options={getBlockchains()}
                  placeholder={{
                    label: "Select network",
                    icon: <EmptyIcon />,
                  }}
                  fullWidth
                  {...field}
                />
              )}
            />
          </div>
          <FieldComboInput<WithdrawFormNearValues>
            fieldName="amountIn"
            selected={selectTokenIn}
            handleSelect={() => {
              handleSelect()
            }}
            className="border rounded-t-xl"
            required="This field is required"
            errors={errors}
            errorSelect={errorSelectTokenIn}
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
              0 {selectTokenIn.symbol}
            </Text>
          </Flex>
          <Flex
            gap="2"
            align="center"
            justify="end"
            className={styles.networkFee}
          >
            <Text>Network fee</Text>
            <Text className={styles.networkFeeValue}>
              0 {selectTokenIn.symbol}
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

function getBlockchains() {
  return {
    near: {
      label: "Near",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/near_dark.svg"
          chainName="Near"
        />
      ),
      value: BlockchainEnum.NEAR,
    },
    ethereum: {
      label: "Ethereum",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/ethereum.svg"
          chainName="Ethereum"
        />
      ),
      value: BlockchainEnum.ETHEREUM,
    },
    base: {
      label: "Base",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/base.svg"
          chainName="Base"
        />
      ),
      value: BlockchainEnum.BASE,
    },
  }
}
