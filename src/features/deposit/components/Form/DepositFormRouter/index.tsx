import { CopyIcon } from "@radix-ui/react-icons"
import { Button, Flex, Text } from "@radix-ui/themes"
import { useEffect, useRef, useState } from "react"
import CopyToClipboard from "react-copy-to-clipboard"
import { Controller, useForm } from "react-hook-form"
import { EmptyIcon } from "src/components/EmptyIcon"
import { NetworkIcon } from "src/components/Network/NetworkIcon"
import { TokenListUpdater } from "src/components/TokenListUpdater"
import { settings } from "src/config/settings"
import type { SwappableToken } from "src/types"
import { isBaseToken } from "src/utils"
import { assert } from "vitest"
import { AssetComboIcon } from "../../../../../components/Asset/AssetComboIcon"
import { Form } from "../../../../../components/Form"
import { Select } from "../../../../../components/Select/Select"
import { useModalController } from "../../../../../hooks"
import { ModalType } from "../../../../../stores/modalStore"
import {
  type BaseAssetInfo,
  DepositBlockchainEnum,
} from "../../../../../types/deposit"
import styles from "./styles.module.css"

export type DepositFormRouterValues = {
  blockchain: DepositBlockchainEnum
  asset: BaseAssetInfo
}

export interface DepositFormRouterProps {
  tokenList: SwappableToken[]
  accountId: string | undefined
  onSubmit: (values: DepositFormRouterValues) => void
}

export const DepositFormRouter = ({
  tokenList,
  onSubmit,
  accountId,
}: DepositFormRouterProps) => {
  const [tokenListFiltered, setTokenListFiltered] = useState<SwappableToken[]>(
    []
  )
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
    token: SwappableToken
  }>(ModalType.MODAL_SELECT_ASSETS, "token")

  const [assetsName, setNameAddress] = useState<string>("")

  const assetChangeRef = useRef(false)

  const openModalSelectAssets = () => {
    assetChangeRef.current = true
    setModalType(ModalType.MODAL_SELECT_ASSETS, {
      fieldName: "asset",
      accountId,
    })
  }

  useEffect(() => {
    if (data?.token && assetChangeRef.current) {
      const address = getAssetAddress(data.token, getValues("blockchain"))
      setNameAddress(data.token.name)
      setValue("asset", {
        address,
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
        setTokenListFiltered(
          tokenList.filter((token) =>
            filterGroupedTokens(token, getValues("blockchain"))
          )
        )
      }
      onSubmit({
        ...getValues(),
      })
    })

    return () => subscription.unsubscribe()
  }, [watch, setValue, onSubmit, getValues, tokenList])

  return (
    <Form<DepositFormRouterValues>
      handleSubmit={handleSubmit(onSubmit)}
      register={register}
    >
      <TokenListUpdater tokenList={tokenListFiltered} />
      <div className={styles.selectWrapper}>
        <Controller
          name="blockchain"
          control={control}
          render={({ field }) => (
            <Select<string, DepositFormRouterValues>
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
      {watch("blockchain") && (
        <button
          type="button"
          className={styles.assetWrapper}
          onClick={openModalSelectAssets}
        >
          <Flex gap="2" align="center" justify="between" width="100%">
            <Flex gap="2" align="center">
              {watch("asset.address") ? (
                <AssetComboIcon icon={watch("asset.icon")} />
              ) : (
                <EmptyIcon />
              )}
              <Text>
                {watch("asset.address") && assetsName
                  ? assetsName
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

function filterGroupedTokens(
  token: SwappableToken,
  blockchain: DepositBlockchainEnum
) {
  if (isBaseToken(token)) {
    return token.chainName.toLowerCase() === blockchain.toLowerCase()
  }
  return token.groupedTokens.find(
    (token) => token.chainName.toLowerCase() === blockchain.toLowerCase()
  )
}

function getAssetAddress(
  token: SwappableToken,
  blockchain: DepositBlockchainEnum
) {
  const address =
    "address" in token
      ? token.address
      : token.groupedTokens.find(
          (token) => token.chainName.toLowerCase() === blockchain.toLowerCase()
        )?.address
  assert(address, "Asset address not found")
  return address
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
