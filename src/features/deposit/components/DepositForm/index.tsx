import {
  CopyIcon,
  ExclamationTriangleIcon,
  InfoCircledIcon,
} from "@radix-ui/react-icons"
import {
  Button,
  Callout,
  Flex,
  Spinner,
  Text,
  useThemeContext,
} from "@radix-ui/themes"
import { useSelector } from "@xstate/react"
import { QRCodeSVG } from "qrcode.react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import CopyToClipboard from "react-copy-to-clipboard"
import { Controller, useFormContext } from "react-hook-form"
import { TooltipInfo } from "src/components/TooltipInfo"
import { RESERVED_NEAR_BALANCE } from "src/features/machines/getBalanceMachine"
import { getPOABridgeInfo } from "src/features/machines/poaBridgeInfoActor"
import { getAvailableDepositRoutes } from "src/services/depositService"
import {
  assetNetworkAdapter,
  reverseAssetNetworkAdapter,
} from "src/utils/adapters"
import { AssetComboIcon } from "../../../../components/Asset/AssetComboIcon"
import { BlockMultiBalances } from "../../../../components/Block/BlockMultiBalances"
import { ButtonCustom } from "../../../../components/Button"
import { EmptyIcon } from "../../../../components/EmptyIcon"
import { Form } from "../../../../components/Form"
import { Input } from "../../../../components/Input"
import type { ModalSelectAssetsPayload } from "../../../../components/Modal/ModalSelectAssets"
import { NetworkIcon } from "../../../../components/Network/NetworkIcon"
import { Select } from "../../../../components/Select/Select"
import { useModalStore } from "../../../../providers/ModalStoreProvider"
import { ModalType } from "../../../../stores/modalStore"
import {
  type BaseTokenInfo,
  BlockchainEnum,
  type ChainType,
  type SwappableToken,
  type UnifiedTokenInfo,
} from "../../../../types"
import { formatTokenValue } from "../../../../utils/format"
import {
  isBaseToken,
  isNativeToken,
  isUnifiedToken,
} from "../../../../utils/token"
import type { Context } from "../../../machines/depositUIMachine"
import { DepositUIMachineContext } from "../DepositUIMachineProvider"
import { Deposits } from "../Deposits"
import styles from "./styles.module.css"

// TODO: Temporary disable deposit through POA bridge
const ENABLE_DEPOSIT_THROUGH_POA_BRIDGE = true

export type DepositFormValues = {
  network: BlockchainEnum | null
  amount: string
  token: BaseTokenInfo | UnifiedTokenInfo | null
  userAddress: string | null
  rpcUrl: string | undefined
}

export const DepositForm = ({ chainType }: { chainType?: ChainType }) => {
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
  const depositNearResult = snapshot.context.depositNearResult
  const depositEVMResult = snapshot.context.depositEVMResult
  const depositSolanaResult = snapshot.context.depositSolanaResult
  const depositTurboResult = snapshot.context.depositTurboResult

  const {
    token,
    blockchain,
    amount,
    balance,
    nativeBalance,
    userAddress,
    poaBridgeInfoRef,
    defuseAssetId,
    preparationOutput,
    parsedAmount,
  } = DepositUIMachineContext.useSelector((snapshot) => {
    const token = snapshot.context.depositFormRef.getSnapshot().context.tokenIn
    const blockchain =
      snapshot.context.depositFormRef.getSnapshot().context.blockchain
    const amount = snapshot.context.depositFormRef.getSnapshot().context.amount
    const parsedAmount =
      snapshot.context.depositFormRef.getSnapshot().context.parsedAmount
    const balance = snapshot.context.balance
    const nativeBalance = snapshot.context.nativeBalance
    const userAddress = snapshot.context.userAddress
    const poaBridgeInfoRef = snapshot.context.poaBridgeInfoRef
    const defuseAssetId = snapshot.context.defuseAssetId
    const preparationOutput = snapshot.context.preparationOutput

    return {
      token,
      blockchain,
      amount,
      balance,
      nativeBalance,
      userAddress,
      poaBridgeInfoRef,
      defuseAssetId,
      preparationOutput,
      parsedAmount,
    }
  })

  const depositAddress =
    preparationOutput?.tag === "ok"
      ? preparationOutput.value.generateDepositAddress
      : null

  const network = blockchain ? assetNetworkAdapter[blockchain] : null

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
        type: "DEPOSIT_FORM.UPDATE_TOKEN",
        params: { token },
      })
      // We have to clean up network because it could be not a valid value for the previous token
      setValue("network", null)
      setValue("amount", "")
      onCloseModal(undefined)
    }
  }, [payload, onCloseModal, depositUIActorRef, setValue])

  const onSubmit = () => {
    depositUIActorRef.send({
      type: "SUBMIT",
    })
  }

  const handleSetMaxValue = async () => {
    if (token == null || tokenBalance == null) return
    const amountToFormat = formatTokenValue(tokenBalance, token.decimals)
    setValue("amount", amountToFormat)
  }

  useEffect(() => {
    if (token && getDefaultBlockchainOptionValue(token)) {
      const networkOption = getDefaultBlockchainOptionValue(token)
      setValue("network", networkOption)
    }
  }, [token, setValue])

  const balanceInsufficient = isInsufficientBalance(
    amount,
    balance,
    nativeBalance,
    token,
    network,
    defuseAssetId
  )

  const minDepositAmount = useSelector(poaBridgeInfoRef, (state) => {
    if (token == null || !isBaseToken(token)) {
      return null
    }

    const bridgedTokenInfo = getPOABridgeInfo(state, token)
    return bridgedTokenInfo == null ? null : bridgedTokenInfo.minDeposit
  })

  const isDepositAmountHighEnough =
    minDepositAmount && parsedAmount !== null && parsedAmount > 0n
      ? parsedAmount >= minDepositAmount
      : true

  const availableDepositRoutes =
    chainType && network && getAvailableDepositRoutes(chainType, network)
  const isActiveDeposit = availableDepositRoutes?.activeDeposit
  const isPassiveDeposit = availableDepositRoutes?.passiveDeposit

  const [isCopied, setIsCopied] = useState(false)

  const { accentColor } = useThemeContext()

  const tokenBalance = token
    ? getBalance(token, balance, nativeBalance, defuseAssetId, network)
    : null

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
          {isActiveDeposit && (
            <Input
              name="amount"
              value={watch("amount")}
              onChange={(value) => setValue("amount", value)}
              type={"text"}
              inputMode={"decimal"}
              pattern={"[0-9]*[.]?[0-9]*"}
              autoComplete={"off"}
              ref={(ref) => {
                if (ref) {
                  ref.focus()
                }
              }}
              className={styles.amountInput}
              slotRight={
                <div className={styles.balanceBoxWrapper}>
                  {token &&
                    isBaseToken(token) &&
                    token.address === "wrap.near" && (
                      <TooltipInfo
                        icon={
                          <Text asChild color={accentColor}>
                            <InfoCircledIcon />
                          </Text>
                        }
                      >
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
                  {tokenBalance != null && token != null && (
                    <BlockMultiBalances
                      balance={tokenBalance}
                      decimals={token.decimals}
                      handleClick={() => handleSetMaxValue()}
                      disabled={tokenBalance === 0n}
                      className={styles.blockMultiBalances}
                    />
                  )}
                </div>
              }
            />
          )}
          {(isActiveDeposit || !network) && (
            <div className={styles.buttonGroup}>
              <ButtonCustom
                size={"lg"}
                disabled={
                  !watch("amount") ||
                  balanceInsufficient ||
                  !isDepositAmountHighEnough
                }
                isLoading={
                  snapshot.matches("submittingNearTx") ||
                  snapshot.matches("submittingEVMTx") ||
                  snapshot.matches("submittingSolanaTx") ||
                  snapshot.matches("submittingTurboTx")
                }
              >
                {renderDepositButtonText(
                  watch("amount") >= "0" && balanceInsufficient,
                  network,
                  token,
                  minDepositAmount,
                  isDepositAmountHighEnough
                )}
              </ButtonCustom>
            </div>
          )}
          <Deposits
            chainName={
              network != null ? reverseAssetNetworkAdapter[network] : null
            }
            depositResult={
              depositNearResult ??
              depositTurboResult ??
              depositEVMResult ??
              depositSolanaResult
            }
          />
          {isPassiveDeposit &&
            ENABLE_DEPOSIT_THROUGH_POA_BRIDGE &&
            network &&
            userAddress && (
              <div className={styles.containerQr}>
                <h2 className={styles.title}>Deposit to the address below</h2>
                <p className={styles.instruction}>
                  Withdraw assets from an exchange to the{" "}
                  {networkSelectToLabel[network]} address below. Upon
                  confirmation, you will receive your assets on Defuse within
                  minutes.
                </p>
                <div className={styles.qrCodeWrapper}>
                  {depositAddress ? (
                    <QRCodeSVG value={depositAddress} />
                  ) : (
                    <Spinner loading={true} />
                  )}
                </div>
                {depositAddress && (
                  <Input
                    name="generatedAddress"
                    value={
                      depositAddress ? truncateUserAddress(depositAddress) : ""
                    }
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
                        disabled={!depositAddress}
                      >
                        <CopyToClipboard
                          text={depositAddress}
                          onCopy={() => setIsCopied(true)}
                        >
                          <Flex gap="2" align="center">
                            <Text color={accentColor}>
                              {isCopied ? "Copied" : "Copy"}
                            </Text>
                            <Text color={accentColor} asChild>
                              <CopyIcon height="14" width="14" />
                            </Text>
                          </Flex>
                        </CopyToClipboard>
                      </Button>
                    }
                  />
                )}
                {renderDepositHint(network, minDepositAmount, token)}
              </div>
            )}
        </Form>
        {token &&
          network &&
          network !== BlockchainEnum.NEAR &&
          !ENABLE_DEPOSIT_THROUGH_POA_BRIDGE && <UnderFeatureFlag />}
        {token &&
          renderDepositWarning(userAddress, {
            depositNearResult,
            depositEVMResult,
            depositSolanaResult,
            depositTurboResult,
            preparationOutput,
            snapshot: snapshot.context,
          })}
        {userAddress && network && !isActiveDeposit && !isPassiveDeposit && (
          <NotSupportedDepositRoute />
        )}
      </div>
    </div>
  )
}

function getBlockchainsOptions(): Record<
  BlockchainEnum,
  { label: string; icon: React.ReactNode; value: BlockchainEnum }
> {
  const options = {
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
    [BlockchainEnum.SOLANA]: {
      label: "Solana",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/solana.svg"
          chainName="solana"
        />
      ),
      value: BlockchainEnum.SOLANA,
    },
    [BlockchainEnum.DOGECOIN]: {
      label: "Dogecoin",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/dogecoin.svg"
          chainName="dogecoin"
        />
      ),
      value: BlockchainEnum.DOGECOIN,
    },
    [BlockchainEnum.TURBOCHAIN]: {
      label: "TurboChain",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/turbochain.png"
          chainName="turbochain"
        />
      ),
      value: BlockchainEnum.TURBOCHAIN,
    },
    [BlockchainEnum.AURORA]: {
      label: "Aurora",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/aurora.svg"
          chainName="aurora"
        />
      ),
      value: BlockchainEnum.AURORA,
    },
    [BlockchainEnum.XRPLEDGER]: {
      label: "XRP Ledger",
      icon: (
        <NetworkIcon
          chainIcon="/static/icons/network/xrpledger.svg"
          chainName="XRP Ledger"
        />
      ),
      value: BlockchainEnum.XRPLEDGER,
    },
  }
  return options
}

function filterBlockchainsOptions(
  token: SwappableToken
): Record<string, { label: string; icon: React.ReactNode; value: string }> {
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

function getDefaultBlockchainOptionValue(
  token: SwappableToken
): BlockchainEnum | null {
  if (isBaseToken(token)) {
    const key = assetNetworkAdapter[token.chainName]
    return key
      ? (getBlockchainsOptions()[key]?.value as BlockchainEnum | null)
      : null
  }
  return null
}

function isInsufficientBalance(
  formAmount: string,
  balance: bigint,
  nativeBalance: bigint,
  token: SwappableToken | null,
  network: BlockchainEnum | null,
  defuseAssetId: string | null
) {
  if (!token || !network) {
    return false
  }
  const balanceToFormat = formatTokenValue(
    getBalance(token, balance, nativeBalance, defuseAssetId, network),
    token.decimals
  )
  return Number.parseFloat(formAmount) > Number.parseFloat(balanceToFormat)
}

function renderDepositWarning(
  userAddress: string | null,
  depositResults: {
    depositNearResult: Context["depositNearResult"]
    depositEVMResult: Context["depositEVMResult"]
    depositSolanaResult: Context["depositSolanaResult"]
    depositTurboResult: Context["depositTurboResult"]
    preparationOutput: Context["preparationOutput"]
    snapshot: Context
  }
) {
  let content: ReactNode = null
  if (!userAddress) {
    content = "Please connect your wallet to continue"
  }

  // Check for errors in deposit results
  const results = [
    depositResults.depositNearResult,
    depositResults.depositEVMResult,
    depositResults.depositSolanaResult,
    depositResults.depositTurboResult,
    depositResults.preparationOutput,
    depositResults.snapshot.error,
  ]

  const errorResult = results.find(
    (result) => result !== null && result.tag === "err"
  )

  if (errorResult) {
    // Check if the errorResult has a 'reason' property
    const status =
      "reason" in errorResult.value
        ? errorResult.value.reason
        : "An error occurred. Please try again."

    switch (status) {
      case "ERR_SUBMITTING_TRANSACTION":
        content =
          "It seems the transaction was rejected in your wallet. Please try again."
        break
      case "ERR_GENERATING_ADDRESS":
        content =
          "It seems the deposit address was not generated. Please try re-selecting the token and network."
        break
      case "ERR_GET_BALANCE":
        content = "It seems the balance is not available. Please try again."
        break
      default:
        content = "An error occurred. Please try again."
    }
  }

  if (!content) {
    return null
  }

  return (
    <Callout.Root size={"1"} color="red" mt="4">
      <Callout.Icon>
        <ExclamationTriangleIcon />
      </Callout.Icon>
      <Callout.Text>{content}</Callout.Text>
    </Callout.Root>
  )
}

function UnderFeatureFlag() {
  return (
    <Callout.Root size={"1"} color="yellow" mt="4">
      <Callout.Icon>
        <ExclamationTriangleIcon />
      </Callout.Icon>
      <Callout.Text>
        Temporaty disable feature, please use NEAR bridge to deposit
      </Callout.Text>
    </Callout.Root>
  )
}

function NotSupportedDepositRoute() {
  return (
    <Callout.Root size={"1"} color="yellow" mt="4">
      <Callout.Icon>
        <ExclamationTriangleIcon />
      </Callout.Icon>
      <Callout.Text>
        Deposit is not supported for this wallet connection, please try another
        token or network
      </Callout.Text>
    </Callout.Root>
  )
}

function renderDepositButtonText(
  isBalanceInsufficient: boolean,
  network: BlockchainEnum | null,
  token: SwappableToken | null,
  minDepositAmount: bigint | null,
  isDepositAmountHighEnough: boolean
) {
  if (!isDepositAmountHighEnough && minDepositAmount != null && token != null) {
    return `Minimal amount to deposit is ${formatTokenValue(minDepositAmount, token.decimals)} ${token.symbol}`
  }
  if (isBalanceInsufficient) {
    return "Insufficient Balance"
  }
  if (!!network && !!token) {
    return "Deposit"
  }
  return !network && !token ? "Select asset first" : "Select network"
}

const networkSelectToLabel: Record<BlockchainEnum, string> = {
  [BlockchainEnum.NEAR]: "NEAR",
  [BlockchainEnum.ETHEREUM]: "Ethereum",
  [BlockchainEnum.BASE]: "Base",
  [BlockchainEnum.ARBITRUM]: "Arbitrum",
  [BlockchainEnum.BITCOIN]: "Bitcoin",
  [BlockchainEnum.SOLANA]: "Solana",
  [BlockchainEnum.DOGECOIN]: "Dogecoin",
  [BlockchainEnum.TURBOCHAIN]: "TurboChain",
  [BlockchainEnum.AURORA]: "Aurora",
  [BlockchainEnum.XRPLEDGER]: "XRP Ledger",
}

function renderDepositHint(
  network: BlockchainEnum | null,
  minDepositAmount: bigint | null,
  token: SwappableToken | null
) {
  return (
    <Callout.Root size={"1"} color="indigo" variant="soft">
      <Callout.Icon>
        <InfoCircledIcon />
      </Callout.Icon>

      {network != null && (
        <Callout.Text>
          Make sure to select {networkSelectToLabel[network]} as the deposit
          network
        </Callout.Text>
      )}

      {minDepositAmount != null && minDepositAmount > 1n && token != null && (
        <Callout.Text>
          Minimal amount to deposit is{" "}
          <Text size={"1"} weight={"bold"}>
            {formatTokenValue(minDepositAmount, token.decimals)} {token.symbol}
          </Text>
        </Callout.Text>
      )}
    </Callout.Root>
  )
}

function truncateUserAddress(hash: string) {
  return `${hash.slice(0, 12)}...${hash.slice(-12)}`
}

// TODO: When Aurora network will be added we should cover a special case for Aurora token on Aurora network
//       network === BlockchainEnum.AURORA && defuseAssetId === "nep141:aurora"
function getBalance(
  token: SwappableToken,
  balance: bigint,
  nativeBalance: bigint,
  defuseAssetId: string | null,
  network: BlockchainEnum | null
) {
  // For user experience, both NEAR and wNEAR are treated as equivalent during the deposit process.
  // This allows users to deposit either token seamlessly.
  // When the balance is checked, it considers the total of both NEAR and wNEAR,
  // ensuring that users can deposit without needing to convert between the two.
  if (
    isUnifiedToken(token) &&
    token.unifiedAssetId === "near" &&
    network === BlockchainEnum.NEAR
  ) {
    return balance + nativeBalance
  }

  if (isNativeToken(token)) {
    return nativeBalance
  }

  if (network && isUnifiedToken(token)) {
    const tokenAddress =
      isUnifiedToken(token) &&
      token.groupedTokens.find((t) => t.defuseAssetId === defuseAssetId)
        ?.address
    switch (network) {
      case BlockchainEnum.NEAR:
        return balance
      case BlockchainEnum.ETHEREUM:
      case BlockchainEnum.BASE:
      case BlockchainEnum.ARBITRUM:
      case BlockchainEnum.BITCOIN:
      case BlockchainEnum.SOLANA:
      case BlockchainEnum.DOGECOIN:
      case BlockchainEnum.TURBOCHAIN:
      case BlockchainEnum.AURORA:
      case BlockchainEnum.XRPLEDGER:
        return tokenAddress === "native" ? nativeBalance : balance
      default:
        network satisfies never
        throw new Error("exhaustive check failed")
    }
  }

  return balance
}
