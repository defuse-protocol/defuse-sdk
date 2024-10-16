import { useForm } from "react-hook-form"

import { Button, Spinner, Text } from "@radix-ui/themes"
import { useEffect, useState } from "react"
import { ModalType } from "src/stores/modalStore"
import { Form } from "../../../../../components/Form"
import { Select } from "../../../../../components/Select/Select"
import { useModalController } from "../../../../../hooks"
import type { BaseTokenInfo } from "../../../../../types/base"
import { BlockchainEnum } from "../../../../../types/deposit"
import styles from "./styles.module.css"

export type DepositFormRouterValues = {
  blockchain: BlockchainEnum
  asset: {
    address: string
    decimals: number
    icon: string
  }
}

export interface DepositFormRouterProps {
  onSubmit: (values: DepositFormRouterValues) => void
}

const blockchains = {
  near: { label: BlockchainEnum.NEAR, icon: null },
  ethereum: { label: BlockchainEnum.ETHEREUM, icon: null },
  base: { label: BlockchainEnum.BASE, icon: null },
}

export const DepositFormRouter = ({ onSubmit }: DepositFormRouterProps) => {
  const {
    handleSubmit,
    register,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<DepositFormRouterValues>({ reValidateMode: "onSubmit" })
  const { setModalType, data } = useModalController<{
    modalType: ModalType
    token: BaseTokenInfo
  }>(ModalType.MODAL_DEPOSIT_SELECT_ASSETS, "token")

  const [selectToken, setSelectToken] = useState<BaseTokenInfo>()
  const [assets, setAssets] = useState<{
    [key: string]: {
      label: string
      icon: string | null
    }
  }>({})

  const handleAssetChange = () => {
    setModalType(ModalType.MODAL_DEPOSIT_SELECT_ASSETS, {
      fieldName: "asset",
      selectToken,
    })
  }

  useEffect(() => {
    if (data?.token) {
      console.log("data.token", data.token)
      setSelectToken(data.token)
      setAssets((prevAssets) => ({
        ...prevAssets,
        [data.token.address]: {
          label: data.token.symbol,
          icon: data.token.icon,
        },
      }))
      setValue("asset", {
        address: data.token.address,
        decimals: data.token.decimals,
        icon: data.token.icon,
      })
    }
  }, [data, setValue])

  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <Form<DepositFormRouterValues>
          handleSubmit={handleSubmit(onSubmit)}
          register={register}
        >
          <div className={styles.selectWrapper}>
            <Select<BlockchainEnum, DepositFormRouterValues>
              name="blockchain"
              register={register}
              options={blockchains}
              placeholder={{ label: "Select blockchain", icon: null }}
              fullWidth
            />
          </div>
          {watch("blockchain") && (
            <button
              type="button"
              onClick={handleAssetChange}
              className={`${styles.buttonWrapper} ${styles.clickableDisabled}`}
            >
              <Select<string, DepositFormRouterValues>
                name="asset"
                register={register}
                options={assets}
                placeholder={{ label: "Select asset", icon: null }}
                fullWidth
                value={{
                  label: getValues("asset")?.address,
                  icon: getValues("asset")?.icon,
                }}
              />
            </button>
          )}
          <div className={styles.buttonGroup}>
            {watch("blockchain") !== BlockchainEnum.NEAR && (
              <Button
                variant="classic"
                size="3"
                radius="large"
                className={`${styles.button} ${styles.orangeButton}`}
              >
                <div className={styles.buttonContent}>
                  <Spinner loading={false} />
                  <Text size="6">Generate deposit address</Text>
                </div>
              </Button>
            )}
            {watch("blockchain") === BlockchainEnum.NEAR && (
              <Button
                variant="classic"
                size="3"
                radius="large"
                className={styles.button}
              >
                <div className={styles.buttonContent}>
                  <Spinner loading={false} />
                  <Text size="6">Deposit via Near</Text>
                </div>
              </Button>
            )}
          </div>
        </Form>
      </div>
    </div>
  )
}
