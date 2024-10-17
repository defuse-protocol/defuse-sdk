import { useForm } from "react-hook-form"

import { Button, Spinner, Text } from "@radix-ui/themes"
import { useEffect, useState } from "react"
import { EmptyIcon } from "src/components/EmptyIcon"
import { NetworkIcon } from "src/components/Network/NetworkIcon"
import { Form } from "../../../../../components/Form"
import { Select } from "../../../../../components/Select/Select"
import { useModalController } from "../../../../../hooks"
import { ModalType } from "../../../../../stores/modalStore"
import type { BaseTokenInfo } from "../../../../../types/base"
import {
  type BaseAssetInfo,
  BlockchainEnum,
} from "../../../../../types/deposit"
import styles from "./styles.module.css"

export type DepositFormRouterValues = {
  blockchain: BlockchainEnum
} & BaseAssetInfo

export interface DepositFormRouterProps {
  onSubmit: (values: DepositFormRouterValues) => void
}

const blockchains = {
  near: {
    label: BlockchainEnum.NEAR,
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/near.svg"
        chainName={BlockchainEnum.NEAR}
      />
    ),
  },
  ethereum: {
    label: BlockchainEnum.ETHEREUM,
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/ethereum.svg"
        chainName={BlockchainEnum.ETHEREUM}
      />
    ),
  },
  base: {
    label: BlockchainEnum.BASE,
    icon: (
      <NetworkIcon
        chainIcon="/static/icons/network/base.svg"
        chainName={BlockchainEnum.BASE}
      />
    ),
  },
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

  const [assets, setAssets] = useState<{
    [key: string]: {
      label: string
      icon: string | null
    }
  }>({})

  const handleAssetChange = () => {
    setModalType(ModalType.MODAL_DEPOSIT_SELECT_ASSETS, {
      blockchain: getValues("blockchain"),
    })
  }

  useEffect(() => {
    if (data?.token) {
      setAssets((prevAssets) => ({
        ...prevAssets,
        [data.token.address]: {
          label: data.token.symbol,
          icon: data.token.icon,
        },
      }))
      setValue("address", data.token.address)
      setValue("decimals", data.token.decimals)
      setValue("icon", data.token.icon)
      setValue("symbol", data.token.symbol)
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
              placeholder={{
                label: "Select network",
                icon: <EmptyIcon />,
              }}
              fullWidth
            />
          </div>
          {watch("blockchain") && (
            <button
              type="button"
              onClick={handleAssetChange}
              className={`${styles.buttonWrapper} ${styles.clickableDisabled}`}
            >
              <div className={styles.selectWrapper}>
                <input
                  {...register("address")}
                  placeholder="Select asset"
                  className={styles.selectInput}
                />
              </div>
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
