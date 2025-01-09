import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Callout, Flex, Text } from "@radix-ui/themes"
import { useSelector } from "@xstate/react"
import { useEffect, useState } from "react"
import { Controller, useFormContext } from "react-hook-form"
import { assetNetworkAdapter } from "src/utils/adapters"
import { AssetComboIcon } from "../../../../components/Asset/AssetComboIcon"
import { EmptyIcon } from "../../../../components/EmptyIcon"
import { Form } from "../../../../components/Form"
import type { ModalSelectAssetsPayload } from "../../../../components/Modal/ModalSelectAssets"
import { NetworkIcon } from "../../../../components/Network/NetworkIcon"
import { Select } from "../../../../components/Select/Select"
import { Separator } from "../../../../components/Separator"
import { getPOABridgeInfo } from "../../../../features/machines/poaBridgeInfoActor"
import { useModalStore } from "../../../../providers/ModalStoreProvider"
import { getAvailableDepositRoutes } from "../../../../services/depositService"
import { ModalType } from "../../../../stores/modalStore"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../../types/base"
import type { ChainType } from "../../../../types/deposit"
import { BlockchainEnum } from "../../../../types/interfaces"
import type { SwappableToken } from "../../../../types/swap"
import { isBaseToken, isUnifiedToken } from "../../../../utils/token"
import { DepositUIMachineContext } from "../DepositUIMachineProvider"
import { DepositWarning } from "../DepositWarning"
import { ActiveDeposit } from "./ActiveDeposit"
import { DepositMethodSelector } from "./DepositMethodSelector"
import { PassiveDeposit } from "./PassiveDeposit"

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
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-2.5">
            <div className="font-bold text-label text-sm">
              Select asset and network
            </div>

            <button
              type="button"
              className="flex items-center justify-center text-base leading-6 h-14 px-4 gap-3 bg-gray-50 text-gray-500 max-w-full box-border flex-shrink-0 rounded-lg border border-gray-300 hover:bg-gray-200/50"
              onClick={() => openModalSelectAssets("token", token ?? undefined)}
            >
              <Flex gap="2" align="center" justify="between" width="100%">
                <Flex gap="2" align="center">
                  {token ? (
                    <AssetComboIcon icon={token?.icon} />
                  ) : (
                    <EmptyIcon circle />
                  )}
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
          </div>

          {currentDepositOption != null && (
            <>
              {isActiveDeposit && isPassiveDeposit && (
                <>
                  <div className="-mx-5">
                    <Separator />
                  </div>

                  <DepositMethodSelector
                    selectedDepositOption={currentDepositOption}
                    onSelectDepositOption={setPreferredDepositOption}
                  />
                </>
              )}

              <div className="-mx-5">
                <Separator />
              </div>

              {currentDepositOption === "active" &&
                network != null &&
                derivedToken != null && (
                  <ActiveDeposit
                    network={network}
                    token={derivedToken}
                    minDepositAmount={minDepositAmount}
                  />
                )}

              {currentDepositOption === "passive" &&
                network != null &&
                derivedToken != null && (
                  <PassiveDeposit
                    network={network}
                    depositAddress={depositAddress}
                    minDepositAmount={minDepositAmount}
                    token={derivedToken}
                  />
                )}
            </>
          )}
        </Form>

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
