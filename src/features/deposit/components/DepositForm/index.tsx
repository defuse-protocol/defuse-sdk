import { Button, Flex, Spinner, Text } from "@radix-ui/themes"
import { useEffect } from "react"
import { Controller, useFormContext } from "react-hook-form"
import { AssetComboIcon } from "src/components/Asset/AssetComboIcon"
import { EmptyIcon } from "src/components/EmptyIcon"
import type { ModalSelectAssetsPayload } from "src/components/Modal/ModalSelectAssets"
import { NetworkIcon } from "src/components/Network/NetworkIcon"
import {
  useGetNearNativeBalance,
  useGetNearNep141Balance,
} from "src/hooks/useNearGetTokenBalance"
import { useModalStore } from "src/providers/ModalStoreProvider"
import { ModalType } from "src/stores/modalStore"
import { DepositBlockchainEnum, type SwappableToken } from "src/types"
import { isBaseToken } from "src/utils"
import { formatTokenValue } from "src/utils/format"
import { Form } from "../../../../components/Form"
import { Input } from "../../../../components/Input"
import { Select } from "../../../../components/Select/Select"
import { DepositUIMachineContext } from "../DepositUIMachineProvider"
import styles from "./styles.module.css"

export type DepositFormValues = {
  network: string
  amount: string
  token: SwappableToken | null
  userAddress: string | null
}

export const DepositForm = () => {
  const {
    handleSubmit,
    register,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<DepositFormValues>()

  const depositUIActorRef = DepositUIMachineContext.useActorRef()
  const snapshot = DepositUIMachineContext.useSelector((snapshot) => snapshot)
  const depositResult = snapshot.context.depositResult

  const { token, network, amount, balance, nativeBalance } =
    DepositUIMachineContext.useSelector((snapshot) => {
      const token = snapshot.context.formValues.token
      const network = snapshot.context.formValues.network
      const amount = snapshot.context.formValues.amount
      const balance = snapshot.context.balance
      const nativeBalance = snapshot.context.nativeBalance
      return {
        token,
        network,
        amount,
        balance,
        nativeBalance,
      }
    })

  // TODO: remove
  console.log(snapshot.context, "snapshot")

  const { setModalType, payload, onCloseModal } = useModalStore(
    (state) => state
  )

  const openModalSelectAssets = (
    fieldName: string,
    selectToken: SwappableToken | undefined
  ) => {
    setModalType(ModalType.MODAL_SELECT_ASSETS, {
      fieldName,
      selectToken,
    })
  }

  useEffect(() => {
    if (
      (payload as ModalSelectAssetsPayload)?.modalType !==
      ModalType.MODAL_SELECT_ASSETS
    ) {
      return
    }
    const { modalType, fieldName, token } = payload as ModalSelectAssetsPayload
    if (modalType === ModalType.MODAL_SELECT_ASSETS && fieldName && token) {
      depositUIActorRef.send({ type: "INPUT", params: { token } })
      onCloseModal(undefined)
    }
  }, [payload, onCloseModal, depositUIActorRef])

  const onSubmit = (values: DepositFormValues) => {
    console.log(values)
  }

  const handleSetMaxValue = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    e.preventDefault()
    if (!token) {
      return
    }
    let maxValue = 0n
    if (isBaseToken(token) && token?.address === "wrap.near") {
      maxValue = (nativeBalance || 0n) + (balance || 0n)
    } else {
      maxValue = balance || 0n
    }
    setValue("amount", formatTokenValue(maxValue, token.decimals))
  }

  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <Form<DepositFormValues>
          handleSubmit={handleSubmit(onSubmit)}
          register={register}
        >
          <button
            type="button"
            className={styles.assetWrapper}
            onClick={() => openModalSelectAssets("token", token ?? undefined)}
          >
            <Flex gap="2" align="center" justify="between" width="100%">
              <Flex gap="2" align="center">
                {token ? <AssetComboIcon icon={token?.icon} /> : <EmptyIcon />}
                <Text>{token?.name ?? "Select asset"}</Text>
              </Flex>
            </Flex>
          </button>
          {token && (
            <div className={styles.selectWrapper}>
              <Controller
                name="network"
                control={control}
                render={({ field }) => (
                  <Select
                    options={getBlockchainsOptions()}
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
          )}
          {network === DepositBlockchainEnum.NEAR && (
            <>
              <Input
                name="amount"
                value={watch("amount")}
                onChange={(value) => setValue("amount", value)}
                type="number"
                slotRight={
                  <Button
                    className={styles.maxButton}
                    size="2"
                    onClick={handleSetMaxValue}
                  >
                    <Text color="orange">Max</Text>
                  </Button>
                }
              />
              <div className={styles.buttonGroup}>
                <Button
                  variant="classic"
                  size="3"
                  radius="large"
                  className={`${styles.button}`}
                  color="orange"
                  disabled={!watch("amount")}
                >
                  <span className={styles.buttonContent}>
                    <Spinner loading={false} />
                    <Text size="6">Deposit</Text>
                  </span>
                </Button>
              </div>
            </>
          )}
          {network && network !== DepositBlockchainEnum.NEAR && <Text>X</Text>}
        </Form>
      </div>
    </div>
  )
}

function getBlockchainsOptions(): Record<
  string,
  { label: string; icon: React.ReactNode }
> {
  return {
    near: {
      label: DepositBlockchainEnum.NEAR,
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/near.svg"
          chainName={DepositBlockchainEnum.NEAR}
        />
      ),
    },
    ethereum: {
      label: DepositBlockchainEnum.ETHEREUM,
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/ethereum.svg"
          chainName={DepositBlockchainEnum.ETHEREUM}
        />
      ),
    },
    base: {
      label: DepositBlockchainEnum.BASE,
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/base.svg"
          chainName={DepositBlockchainEnum.BASE}
        />
      ),
    },
  }
}
