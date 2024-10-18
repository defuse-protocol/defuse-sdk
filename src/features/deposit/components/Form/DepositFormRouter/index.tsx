import { useForm } from "react-hook-form"

import { useEffect, useRef, useState } from "react"
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
import depositFormRouterStyles from "./styles.module.css"

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

  const assetChangeRef = useRef(false)

  const handleAssetChange = () => {
    assetChangeRef.current = true
    setModalType(ModalType.MODAL_DEPOSIT_SELECT_ASSETS, {
      blockchain: getValues("blockchain"),
    })
  }

  useEffect(() => {
    if (data?.token && assetChangeRef.current) {
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
      onSubmit({
        ...getValues(),
      })
      assetChangeRef.current = false
    }
  }, [data, setValue, onSubmit, getValues])

  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name === "blockchain") {
        setValue("address", "")
        setValue("decimals", 0)
        setValue("icon", "")
        setValue("symbol", "")
      }
      onSubmit({
        ...getValues(),
      })
    })

    return () => subscription.unsubscribe()
  }, [watch, setValue, onSubmit, getValues])

  return (
    <Form<DepositFormRouterValues>
      handleSubmit={handleSubmit(onSubmit)}
      register={register}
    >
      <div className={depositFormRouterStyles.selectWrapper}>
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
          className={`${depositFormRouterStyles.buttonWrapper} ${depositFormRouterStyles.clickableDisabled}`}
        >
          <div className={depositFormRouterStyles.selectWrapper}>
            <input
              {...register("address")}
              placeholder="Select asset"
              className={depositFormRouterStyles.selectInput}
            />
          </div>
        </button>
      )}
    </Form>
  )
}
