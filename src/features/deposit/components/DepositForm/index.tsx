import { CopyIcon, InfoCircledIcon } from "@radix-ui/react-icons"
import { Box, Button, Flex, Link, Spinner, Text } from "@radix-ui/themes"
import { QRCodeSVG } from "qrcode.react"
import { useEffect, useRef } from "react"
import CopyToClipboard from "react-copy-to-clipboard"
import { Controller, useFormContext } from "react-hook-form"
import { TooltipInfo } from "src/components/TooltipInfo"
import { RESERVED_NEAR_BALANCE } from "src/features/machines/getBalanceMachine"
import { assetNetworkAdapter } from "src/utils/adapters"
import { AssetComboIcon } from "../../../../components/Asset/AssetComboIcon"
import { BlockMultiBalances } from "../../../../components/Block/BlockMultiBalances"
import { EmptyIcon } from "../../../../components/EmptyIcon"
import { Form } from "../../../../components/Form"
import { Input } from "../../../../components/Input"
import type { ModalSelectAssetsPayload } from "../../../../components/Modal/ModalSelectAssets"
import { NetworkIcon } from "../../../../components/Network/NetworkIcon"
import { Select } from "../../../../components/Select/Select"
import { useModalStore } from "../../../../providers/ModalStoreProvider"
import { ModalType } from "../../../../stores/modalStore"
import { BlockchainEnum, type SwappableToken } from "../../../../types"
import { formatTokenValue } from "../../../../utils/format"
import { isBaseToken, isUnifiedToken } from "../../../../utils/token"
import { DepositUIMachineContext } from "../DepositUIMachineProvider"
import { Deposits } from "../Deposits"
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
  const generatedAddressResult = snapshot.context.generatedAddressResult

  const { token, network, amount, balance, nativeBalance, userAddress } =
    DepositUIMachineContext.useSelector((snapshot) => {
      const token = snapshot.context.formValues.token
      const network = snapshot.context.formValues.network
      const amount = snapshot.context.formValues.amount
      const balance = snapshot.context.balance
      const nativeBalance = snapshot.context.nativeBalance
      const userAddress = snapshot.context.userAddress
      return {
        token,
        network,
        amount,
        balance,
        nativeBalance,
        userAddress,
      }
    })

  // TODO: remove
  console.log(snapshot.context, "snapshot")
  console.log(snapshot.value, "state")

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
      depositUIActorRef.send({
        type: "INPUT",
        params: { token, network: undefined },
      })
      // We have to clean up network because it could be not a valid value for the previous token
      setValue("network", "")
      setValue("amount", "")
      onCloseModal(undefined)
    }
  }, [payload, onCloseModal, depositUIActorRef, setValue])

  const onSubmit = () => {
    depositUIActorRef.send({
      type: "SUBMIT",
    })
  }

  const handleSetMaxValue = () => {
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

  useEffect(() => {
    if (token && getDefaultBlockchainOptionValue(token)) {
      const networkOption = getDefaultBlockchainOptionValue(token)
      setValue("network", networkOption ?? "")
    }
  }, [token, setValue])

  const balanceInsufficient = isInsufficientBalance(
    amount,
    balance,
    nativeBalance,
    token,
    network
  )

  const amountInputRef = useRef<HTMLInputElement | null>(null)

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
                    options={filterBlockchainsOptions(token)}
                    placeholder={{
                      label: "Select network",
                      icon: <EmptyIcon />,
                    }}
                    fullWidth
                    value={
                      getDefaultBlockchainOptionValue(token) || network || ""
                    }
                    disabled={!isUnifiedToken(token)}
                    onChange={field.onChange}
                    name={field.name}
                    ref={field.ref}
                  />
                )}
              />
            </div>
          )}
          {network === BlockchainEnum.NEAR && (
            <>
              <Input
                name="amount"
                value={watch("amount")}
                onChange={(value) => setValue("amount", value)}
                type="number"
                ref={(ref) => {
                  if (network === BlockchainEnum.NEAR && ref) {
                    ref.focus()
                  }
                  amountInputRef.current = ref
                }}
                className={styles.amountInput}
                slotRight={
                  <div className={styles.balanceBoxWrapper}>
                    {token &&
                      isBaseToken(token) &&
                      token.address === "wrap.near" && (
                        <TooltipInfo icon={<InfoCircledIcon color="orange" />}>
                          Combined balance of NEAR and wNEAR.
                          <br /> NEAR will be automatically wrapped to wNEAR
                          <br /> if your wNEAR balance isn't sufficient for the
                          swap.
                          <br />
                          Note that to cover network fees, we reserve
                          {` ${formatTokenValue(
                            RESERVED_NEAR_BALANCE,
                            token.decimals
                          )} NEAR`}
                          <br /> in your wallet.
                        </TooltipInfo>
                      )}
                    <BlockMultiBalances
                      balance={
                        token &&
                        isBaseToken(token) &&
                        token.address === "wrap.near"
                          ? balance + nativeBalance
                          : balance
                      }
                      decimals={token?.decimals ?? 0}
                      handleClick={() => handleSetMaxValue()}
                      disabled={false}
                      className={styles.blockMultiBalances}
                    />
                  </div>
                }
              />
              <div className={styles.buttonGroup}>
                <Button
                  variant="classic"
                  size="3"
                  radius="large"
                  className={`${styles.button}`}
                  color="orange"
                  disabled={!watch("amount") || balanceInsufficient}
                >
                  <span className={styles.buttonContent}>
                    <Spinner loading={false} />
                    <Text size="6">
                      {watch("amount") >= "0"
                        ? balanceInsufficient
                          ? "Insufficient Balance"
                          : "Deposit"
                        : "Deposit"}
                    </Text>
                  </span>
                </Button>
              </div>
            </>
          )}
          {network && network !== BlockchainEnum.NEAR && (
            <div className={styles.containerQr}>
              <h2 className={styles.title}>Deposit to the address below</h2>
              <p className={styles.instruction}>
                Withdraw assets from an exchange to the Ethereum address above.
                Upon confirmation, you will receive your assets on Defuse within
                minutes.
              </p>
              <div className={styles.qrCodeWrapper}>
                {generatedAddressResult ? (
                  <QRCodeSVG value={generatedAddressResult.depositAddress} />
                ) : (
                  <Spinner loading={true} />
                )}
              </div>
              <Input
                name="generatedAddress"
                value={generatedAddressResult?.depositAddress ?? ""}
                disabled
                className={styles.inputGeneratedAddress}
                slotRight={
                  <Button
                    size="2"
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    className={styles.copyButton}
                    disabled={!generatedAddressResult}
                  >
                    <CopyToClipboard
                      text={generatedAddressResult?.depositAddress ?? ""}
                    >
                      <Flex gap="2" align="center">
                        <Text color="orange">Copy</Text>
                        <CopyIcon height="14" width="14" color="orange" />
                      </Flex>
                    </CopyToClipboard>
                  </Button>
                }
              />
              <Flex
                direction="row"
                gap="2"
                align="center"
                justify="center"
                className={styles.hintWrapper}
              >
                <TooltipInfo icon={<InfoCircledIcon />}>
                  Please make sure you connected to the right network
                </TooltipInfo>
                <p className={styles.hint}>
                  Make sure to select {network} as the deposit network
                </p>
              </Flex>
            </div>
          )}
        </Form>
        <Deposits depositNearResult={snapshot.context.depositNearResult} />
      </div>
    </div>
  )
}

function getBlockchainsOptions(): Record<
  string,
  { label: string; icon: React.ReactNode; value: string }
> {
  return {
    [BlockchainEnum.NEAR]: {
      label: "Near",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/near.svg"
          chainName="near"
        />
      ),
      value: BlockchainEnum.NEAR,
    },
    [BlockchainEnum.ETHEREUM]: {
      label: "Ethereum",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/ethereum.svg"
          chainName="eth"
        />
      ),
      value: BlockchainEnum.ETHEREUM,
    },
    [BlockchainEnum.BASE]: {
      label: "Base",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/base.svg"
          chainName="base"
        />
      ),
      value: BlockchainEnum.BASE,
    },
    [BlockchainEnum.ARBITRUM]: {
      label: "Arbitrum",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/arbitrum.svg"
          chainName="arbitrum"
        />
      ),
      value: BlockchainEnum.ARBITRUM,
    },
    [BlockchainEnum.BITCOIN]: {
      label: "Bitcoin",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/btc.svg"
          chainName="bitcoin"
        />
      ),
      value: BlockchainEnum.BITCOIN,
    },
  }
}

function filterBlockchainsOptions(
  token: SwappableToken
): Record<string, { label: string; icon: React.ReactNode; value: string }> {
  // TODO: use supportedTokensList
  if (isUnifiedToken(token)) {
    return token.groupedTokens.reduce(
      (
        acc: Record<
          string,
          { label: string; icon: React.ReactNode; value: string }
        >,
        token
      ) => {
        const key = assetNetworkAdapter[token.chainName]
        if (key) {
          const option = getBlockchainsOptions()[key]
          if (option) {
            acc[key] = option
          }
        }
        return acc
      },
      {}
    )
  }
  return getBlockchainsOptions()
}

function shortenTxHash(txHash: string) {
  return `${txHash.slice(0, 5)}...${txHash.slice(-5)}`
}

function getDefaultBlockchainOptionValue(
  token: SwappableToken
): string | undefined {
  if (!isUnifiedToken(token)) {
    const key = assetNetworkAdapter[token.chainName]
    return key ? getBlockchainsOptions()[key]?.value : undefined
  }
  return undefined
}

function isInsufficientBalance(
  formAmount: string,
  balance: bigint,
  nativeBalance: bigint,
  token: SwappableToken | null,
  network: BlockchainEnum | null
) {
  if (!token || !network) {
    return false
  }
  const balanceToFormat = formatTokenValue(balance, token.decimals)
  if (network === BlockchainEnum.NEAR) {
    if (isBaseToken(token) && token.address === "wrap.near") {
      const balanceToFormat = formatTokenValue(
        balance + nativeBalance,
        token.decimals
      )
      return Number.parseFloat(formAmount) > Number.parseFloat(balanceToFormat)
    }
    return Number.parseFloat(formAmount) > Number.parseFloat(balanceToFormat)
  }
  return false
}
