import {
  CopyIcon,
  ExclamationTriangleIcon,
  InfoCircledIcon,
} from "@radix-ui/react-icons"
import { Button, Callout, Flex, Spinner, Text } from "@radix-ui/themes"
import { useSelector } from "@xstate/react"
import clsx from "clsx"
import { QRCodeSVG } from "qrcode.react"
import { useEffect, useState } from "react"
import CopyToClipboard from "react-copy-to-clipboard"
import { Controller, useFormContext } from "react-hook-form"
import { assetNetworkAdapter } from "src/utils/adapters"
import { AssetComboIcon } from "../../../../components/Asset/AssetComboIcon"
import { EmptyIcon } from "../../../../components/EmptyIcon"
import { Form } from "../../../../components/Form"
import { Input } from "../../../../components/Input"
import type { ModalSelectAssetsPayload } from "../../../../components/Modal/ModalSelectAssets"
import { NetworkIcon } from "../../../../components/Network/NetworkIcon"
import { Select } from "../../../../components/Select/Select"
import { getPOABridgeInfo } from "../../../../features/machines/poaBridgeInfoActor"
import { useModalStore } from "../../../../providers/ModalStoreProvider"
import { getAvailableDepositRoutes } from "../../../../services/depositService"
import { ModalType } from "../../../../stores/modalStore"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../../types/base"
import type { ChainType } from "../../../../types/deposit"
import { BlockchainEnum } from "../../../../types/interfaces"
import type { SwappableToken } from "../../../../types/swap"
import { formatTokenValue } from "../../../../utils/format"
import { isBaseToken, isUnifiedToken } from "../../../../utils/token"
import { DepositUIMachineContext } from "../DepositUIMachineProvider"
import { DepositWarning } from "../DepositWarning"
import { ActiveDeposit } from "./ActiveDeposit"

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
  const { handleSubmit, register, control, setValue, watch } =
    useFormContext<DepositFormValues>()

  const depositUIActorRef = DepositUIMachineContext.useActorRef()
  const snapshot = DepositUIMachineContext.useSelector((snapshot) => snapshot)
  const depositOutput = snapshot.context.depositOutput
  const preparationOutput = snapshot.context.preparationOutput

  const { token, derivedToken, blockchain, userAddress, poaBridgeInfoRef } =
    DepositUIMachineContext.useSelector((snapshot) => {
      const token = snapshot.context.depositFormRef.getSnapshot().context.token
      const derivedToken =
        snapshot.context.depositFormRef.getSnapshot().context.derivedToken
      const blockchain =
        snapshot.context.depositFormRef.getSnapshot().context.blockchain
      const userAddress = snapshot.context.userAddress
      const poaBridgeInfoRef = snapshot.context.poaBridgeInfoRef

      return {
        token,
        derivedToken,
        blockchain,
        userAddress,
        poaBridgeInfoRef,
      }
    })

  const isOutputOk = preparationOutput?.tag === "ok"
  const depositAddress = isOutputOk
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
      setValue("token", token)
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

  const formNetwork = watch("network")
  useEffect(() => {
    const networkDefaultOption = token
      ? getDefaultBlockchainOptionValue(token)
      : null
    if (formNetwork === null) {
      setValue("network", networkDefaultOption)
    }
  }, [formNetwork, token, setValue])

  const minDepositAmount = useSelector(poaBridgeInfoRef, (state) => {
    if (token == null || !isBaseToken(token)) {
      return null
    }

    const bridgedTokenInfo = getPOABridgeInfo(state, token)
    return bridgedTokenInfo == null ? null : bridgedTokenInfo.minDeposit
  })

  const availableDepositRoutes =
    chainType && network && getAvailableDepositRoutes(chainType, network)
  const isActiveDeposit = availableDepositRoutes?.activeDeposit
  const isPassiveDeposit = availableDepositRoutes?.passiveDeposit

  const [isCopied, setIsCopied] = useState(false)

  const [preferredDepositOption, setPreferredDepositOption] = useState<
    "active" | "passive"
  >("active")

  const currentDepositOption =
    preferredDepositOption === "active" && isActiveDeposit
      ? "active"
      : isPassiveDeposit
        ? "passive"
        : isActiveDeposit
          ? "active"
          : null

  return (
    <div className="w-full max-w-[472px]">
      <div className="rounded-2xl p-5 bg-white shadow dark:bg-[#111110] dark:shadow-[0_1px_3px_0_rgb(255_255_255_/_0.1),_0_1px_2px_-1px_rgb(255_255_255_/_0.1)]">
        <Form<DepositFormValues>
          handleSubmit={handleSubmit(onSubmit)}
          register={register}
          className="flex flex-col gap-4"
        >
          <button
            type="button"
            className="flex items-center justify-center text-base leading-6 h-14 px-4 gap-3 bg-gray-50 text-gray-500 max-w-full box-border flex-shrink-0 rounded-lg border border-gray-300 hover:bg-gray-200/50"
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
            <div className="[&>button[disabled]]:opacity-50 [&>button[disabled]]:cursor-not-allowed [&>button[disabled]]:pointer-events-none [&>*[disabled]]:pointer-events-none">
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
                  />
                )}
              />
            </div>
          )}

          {currentDepositOption == null ? null : (
            <div className="flex flex-col gap-3">
              <div className="font-bold text-gray-950 text-sm">
                Choose deposit method
              </div>

              <div className="flex items-stretch gap-2">
                <Button
                  type="button"
                  onClick={() => setPreferredDepositOption("passive")}
                  disabled={!isPassiveDeposit}
                  size="4"
                  variant={
                    currentDepositOption === "passive" ? "surface" : "outline"
                  }
                  color={
                    currentDepositOption === "passive" ? undefined : "gray"
                  }
                  className={clsx("flex-1 font-bold text-sm", {
                    "ring-2 ring-accent-a700 ring-inset":
                      currentDepositOption === "passive",
                  })}
                >
                  Exchange
                </Button>
                <Button
                  type="button"
                  onClick={() => setPreferredDepositOption("active")}
                  disabled={!isActiveDeposit}
                  size="4"
                  variant={
                    currentDepositOption === "active" ? "surface" : "outline"
                  }
                  color={currentDepositOption === "active" ? undefined : "gray"}
                  className={clsx("flex-1 font-bold text-sm", {
                    "ring-2 ring-accent-a700 ring-inset":
                      currentDepositOption === "active",
                  })}
                >
                  Wallet
                </Button>
              </div>
            </div>
          )}

          {currentDepositOption === "active" &&
            network != null &&
            derivedToken != null && (
              <ActiveDeposit
                network={network}
                token={derivedToken}
                minDepositAmount={minDepositAmount}
              />
            )}

          {currentDepositOption === "passive" && (
            <div className="flex flex-col items-stretch">
              <h2 className="text-[#21201C] text-center text-base font-bold leading-6">
                Deposit to the address below
              </h2>
              <p className="text-[#63635E] text-center text-sm font-normal leading-5 mb-4">
                {/* biome-ignore lint/nursery/useConsistentCurlyBraces: space is needed here */}
                Withdraw assets from an exchange to the{" "}
                {/* biome-ignore lint/nursery/useConsistentCurlyBraces: space is needed here */}
                {network != null ? networkSelectToLabel[network] : "(empty)"}{" "}
                address below. Upon confirmation, you will receive your assets
                on Defuse within minutes.
              </p>
              <div className="flex justify-center items-center w-full min-h-[188px] mb-4 rounded-lg bg-[#FDFDFC] border border-[#F1F1F1] p-4">
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
                  className="min-h-14 py-0 mb-4 [&>input]:text-base"
                  slotRight={
                    <Button
                      type="button"
                      size="2"
                      variant="soft"
                      className="px-3"
                      disabled={!depositAddress}
                    >
                      <CopyToClipboard
                        text={depositAddress}
                        onCopy={() => setIsCopied(true)}
                      >
                        <Flex gap="2" align="center">
                          <Text>{isCopied ? "Copied" : "Copy"}</Text>
                          <Text asChild>
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
        {token && (
          <DepositWarning
            userAddress={userAddress}
            depositWarning={depositOutput || preparationOutput}
          />
        )}
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
  token: BaseTokenInfo | UnifiedTokenInfo
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

function UnderFeatureFlag() {
  return (
    <Callout.Root size="1" color="yellow" mt="4">
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
    <Callout.Root size="1" color="yellow" mt="4">
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
    <Callout.Root size="1" color="indigo" variant="soft">
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
          {/* biome-ignore lint/nursery/useConsistentCurlyBraces: space is needed here */}
          Minimal amount to deposit is{" "}
          <Text size="1" weight="bold">
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
