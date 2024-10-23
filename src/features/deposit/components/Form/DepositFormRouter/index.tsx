import { CopyIcon, PlusIcon } from "@radix-ui/react-icons"
import { Button, Flex, IconButton, Text, TextField } from "@radix-ui/themes"
import { useEffect, useRef, useState } from "react"
import CopyToClipboard from "react-copy-to-clipboard"
import { Controller, useForm } from "react-hook-form"
import { EmptyIcon } from "src/components/EmptyIcon"
import { NetworkIcon } from "src/components/Network/NetworkIcon"
import { AssetComboIcon } from "../../../../../components/Asset/AssetComboIcon"
import { Form } from "../../../../../components/Form"
import { Select } from "../../../../../components/Select/Select"
import { useModalController, useShortAccountId } from "../../../../../hooks"
import { ModalType } from "../../../../../stores/modalStore"
import type { BaseTokenInfo } from "../../../../../types/base"
import {
  type BaseAssetInfo,
  BlockchainEnum,
} from "../../../../../types/deposit"
import styles from "./styles.module.css"

export type DepositFormRouterValues = {
  blockchain: BlockchainEnum
  asset: BaseAssetInfo
}

export interface DepositFormRouterProps {
  onSubmit: (values: DepositFormRouterValues) => void
}

export const blockchains = {
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
    control,
  } = useForm<DepositFormRouterValues>({ reValidateMode: "onSubmit" })
  const { setModalType, data } = useModalController<{
    modalType: ModalType
    token: BaseTokenInfo
  }>(ModalType.MODAL_DEPOSIT_SELECT_ASSETS, "token")

  const [assetsAddress, setAssetsAddress] = useState<string>("")
  const { shortAccountId } = useShortAccountId(assetsAddress)

  const assetChangeRef = useRef(false)

  const handleAssetChange = () => {
    assetChangeRef.current = true
    setModalType(ModalType.MODAL_DEPOSIT_SELECT_ASSETS, {
      blockchain: getValues("blockchain"),
    })
  }

  useEffect(() => {
    if (data?.token && assetChangeRef.current) {
      setAssetsAddress(data.token.address)
      setValue("asset", {
        address: data.token.address,
        decimals: data.token.decimals,
        icon: data.token.icon,
        symbol: data.token.symbol,
      })
      onSubmit({
        ...getValues(),
      })
      assetChangeRef.current = false
    }
  }, [data, setValue, onSubmit, getValues])

  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name === "blockchain") {
        setValue("asset", {
          address: "",
          decimals: 0,
          icon: "",
          symbol: "",
        })
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
      <div className={styles.selectWrapper}>
        <Controller
          name="blockchain"
          control={control}
          render={({ field }) => (
            <Select<BlockchainEnum, DepositFormRouterValues>
              options={blockchains}
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
      {watch("blockchain") && (
        <button
          type="button"
          className={styles.assetWrapper}
          onClick={handleAssetChange}
        >
          <Flex gap="2" align="center" justify="between" width="100%">
            <Flex gap="2" align="center">
              {watch("asset.address") ? (
                <AssetComboIcon icon={watch("asset.icon")} />
              ) : (
                <EmptyIcon />
              )}
              <Text>
                {watch("asset.address") && shortAccountId
                  ? shortAccountId
                  : "Select asset"}
              </Text>
            </Flex>
            {watch("asset.address") && (
              <Button
                size="2"
                onClick={(e) => {
                  e.stopPropagation()
                }}
                className={styles.copyButton}
              >
                <CopyToClipboard text={watch("asset.address")}>
                  <Flex gap="2" align="center">
                    <Text color="orange">Copy</Text>
                    <CopyIcon height="14" width="14" color="orange" />
                  </Flex>
                </CopyToClipboard>
              </Button>
            )}
          </Flex>
        </button>
      )}
    </Form>
  )
}
