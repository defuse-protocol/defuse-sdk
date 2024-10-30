import { CopyIcon, InfoCircledIcon } from "@radix-ui/react-icons"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@radix-ui/react-tooltip"
import { Box, Button, Flex, Link, Spinner, Text } from "@radix-ui/themes"
import { QRCodeSVG } from "qrcode.react"
import { useEffect } from "react"
import CopyToClipboard from "react-copy-to-clipboard"
import { Controller, useFormContext } from "react-hook-form"
import { AssetComboIcon } from "src/components/Asset/AssetComboIcon"
import { EmptyIcon } from "src/components/EmptyIcon"
import type { ModalSelectAssetsPayload } from "src/components/Modal/ModalSelectAssets"
import { NetworkIcon } from "src/components/Network/NetworkIcon"
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
  const generatedAddressResult = snapshot.context.generatedAddressResult
  const depositNearResult = snapshot.context.depositNearResult

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
      depositUIActorRef.send({ type: "INPUT", params: { token } })
      onCloseModal(undefined)
    }
  }, [payload, onCloseModal, depositUIActorRef])

  const onSubmit = () => {
    depositUIActorRef.send({
      type: "SUBMIT",
    })
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
          {network && network !== DepositBlockchainEnum.NEAR && (
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <InfoCircledIcon />
                    </TooltipTrigger>
                    <TooltipContent>
                      <span className={styles.tooltipContent}>
                        Please make sure you connected to the right network
                      </span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <p className={styles.hint}>
                  Make sure to select {network} as the deposit network
                </p>
              </Flex>
            </div>
          )}
        </Form>
        {depositNearResult && (
          <Box>
            <Text size={"1"} color={"gray"}>
              Transaction:
            </Text>{" "}
            <TransactionLink
              txHash={
                depositNearResult.status === "SUCCESSFUL"
                  ? depositNearResult.txHash
                  : ""
              }
            />
          </Box>
        )}
      </div>
    </div>
  )
}

const TransactionLink = ({ txHash }: { txHash: string }) => {
  return (
    <Link href={`https://nearblocks.io/txns/${txHash}`} target={"_blank"}>
      {shortenTxHash(txHash)}
    </Link>
  )
}

function getBlockchainsOptions(): Record<
  string,
  { label: string; icon: React.ReactNode; value: string }
> {
  return {
    near: {
      label: "Near",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/near.svg"
          chainName="near"
        />
      ),
      value: DepositBlockchainEnum.NEAR,
    },
    ethereum: {
      label: "Ethereum",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/ethereum.svg"
          chainName="eth"
        />
      ),
      value: DepositBlockchainEnum.ETHEREUM,
    },
    base: {
      label: "Base",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/base.svg"
          chainName="base"
        />
      ),
      value: DepositBlockchainEnum.BASE,
    },
  }
}

function shortenTxHash(txHash: string) {
  return `${txHash.slice(0, 5)}...${txHash.slice(-5)}`
}
