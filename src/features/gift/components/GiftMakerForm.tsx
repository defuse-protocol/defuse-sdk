import { useActorRef, useSelector } from "@xstate/react"
import clsx from "clsx"
import { useEffect, useMemo } from "react"
import { ButtonCustom } from "src/components/Button/ButtonCustom"
import type { ActorRefFrom } from "xstate"
import { BlockMultiBalances } from "../../../components/Block/BlockMultiBalances"
import type { ModalSelectAssetsPayload } from "../../../components/Modal/ModalSelectAssets"
import { SelectAssets } from "../../../components/SelectAssets"
import type { SignerCredentials } from "../../../core/formatters"
import { useModalController } from "../../../hooks/useModalController"
import { useTokensUsdPrices } from "../../../hooks/useTokensUsdPrices"
import { useTokensStore } from "../../../providers/TokensStoreProvider"
import { ModalType } from "../../../stores/modalStore"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { ChainType } from "../../../types/deposit"
import { assert } from "../../../utils/assert"
import { formatTokenValue, formatUsdAmount } from "../../../utils/format"
import getTokenUsdPrice from "../../../utils/getTokenUsdPrice"
import { TokenAmountInputCard } from "../../deposit/components/DepositForm/TokenAmountInputCard"
import { balanceAllSelector } from "../../machines/depositedBalanceMachine"
import { formValuesSelector } from "../actors/giftMakerFormMachine"
import type { giftMakerReadyActor } from "../actors/giftMakerReadyActor"
import { giftMakerRootMachine } from "../actors/giftMakerRootMachine"
import type { GiftPayload, SignMessage } from "../types/sharedTypes"
import { GiftMakerReadyDialog } from "./GiftMakerReadyDialog"
import { GiftMessageInput } from "./GiftMessageInput"

export type GiftMakerWidgetProps = {
  /** List of available tokens for trading */
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]

  /** User's wallet address */
  userAddress: string | null | undefined
  userChainType: ChainType | null | undefined

  /** Initial tokens for pre-filling the form */
  initialToken?: BaseTokenInfo | UnifiedTokenInfo

  /** Sign message callback */
  signMessage: SignMessage

  /** Function to generate a shareable trade link */
  generateLink: (giftPayload: GiftPayload) => string

  /** Theme selection */
  theme?: "dark" | "light"

  /** Frontend referral */
  referral?: string
}

export function GiftMakerForm({
  tokenList,
  userAddress,
  userChainType,
  initialToken,
  signMessage,
  generateLink,
  referral,
}: GiftMakerWidgetProps) {
  const signerCredentials: SignerCredentials | null = useMemo(
    () =>
      userAddress != null && userChainType != null
        ? {
            credential: userAddress,
            credentialType: userChainType,
          }
        : null,
    [userAddress, userChainType]
  )

  const initialToken_ = initialToken ?? tokenList[0]
  assert(initialToken_ !== undefined, "Token list must not be empty")

  const rootActorRef = useActorRef(giftMakerRootMachine, {
    input: {
      initialToken: initialToken_,
      tokenList,
      referral,
    },
  })

  const formRef = useSelector(rootActorRef, (s) => s.context.formRef)
  const formValuesRef = useSelector(formRef, formValuesSelector)
  const formValues = useSelector(formValuesRef, (s) => s.context)

  const { tokenBalance } = useSelector(
    useSelector(rootActorRef, (s) => s.context.depositedBalanceRef),
    balanceAllSelector({
      tokenBalance: formValues.token,
    })
  )

  const rootSnapshot = useSelector(rootActorRef, (s) => s)
  const { readyGiftRef } = useSelector(rootActorRef, (s) => ({
    readyGiftRef: s.children.readyGiftRef as unknown as
      | undefined
      | ActorRefFrom<typeof giftMakerReadyActor>,
  }))

  const { setModalType, data: modalSelectAssetsData } = useModalController<{
    modalType: ModalType.MODAL_SELECT_ASSETS
    token: BaseTokenInfo | UnifiedTokenInfo | undefined
  }>(ModalType.MODAL_SELECT_ASSETS)

  const updateTokens = useTokensStore((state) => state.updateTokens)

  const handleSelect = (fieldName: string) => {
    updateTokens(tokenList)
    setModalType(ModalType.MODAL_SELECT_ASSETS, {
      fieldName,
      selectToken: undefined,
      balances: tokenBalance,
    })
  }

  const { data: tokensUsdPriceData } = useTokensUsdPrices()
  const usdAmount = getTokenUsdPrice(
    formValues.amount,
    formValues.token,
    tokensUsdPriceData
  )

  /**
   * This is ModalSelectAssets "callback"
   */
  useEffect(() => {
    const payload: ModalSelectAssetsPayload | undefined = modalSelectAssetsData
    if (payload?.modalType !== ModalType.MODAL_SELECT_ASSETS) {
      return
    }

    if (payload.token) {
      const token = payload.token
      payload.token = undefined // consume data, so it won't be triggered again

      formValuesRef.trigger.updateToken({ value: token })
    }
  }, [modalSelectAssetsData, formValuesRef.trigger.updateToken])

  return (
    <div className="flex flex-col">
      {rootSnapshot.matches("signed") &&
        readyGiftRef != null &&
        signerCredentials != null && (
          <GiftMakerReadyDialog
            readyGiftRef={readyGiftRef}
            generateLink={generateLink}
            signerCredentials={signerCredentials}
          />
        )}

      {/* Header Section */}
      <div className="flex flex-row justify-between mb-5">
        <div className="flex flex-col items-start gap-1.5">
          <div className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-2">
            Share gift
          </div>
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Send assets to your friends and help them get started on NEAR
            Intents, hassle-free.
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()

          if (signerCredentials != null) {
            rootActorRef.send({
              type: "REQUEST_SIGN",
              signMessage,
              signerCredentials,
            })
          }
        }}
        className="flex flex-col gap-5"
      >
        <div className="flex flex-col items-center">
          <div className="flex flex-col gap-3">
            <TokenAmountInputCard
              variant="2"
              labelSlot={
                <label
                  htmlFor="gift-amount-in"
                  className="font-bold text-label text-sm"
                >
                  Gift amount
                </label>
              }
              inputSlot={
                <TokenAmountInputCard.Input
                  id="gift-amount-in"
                  name="amount"
                  value={formValues.amount}
                  onChange={(e) =>
                    formValuesRef.trigger.updateAmount({
                      value: e.target.value,
                    })
                  }
                />
              }
              tokenSlot={
                <SelectAssets
                  selected={formValues.token ?? undefined}
                  handleSelect={() => handleSelect("token")}
                />
              }
              balanceSlot={
                <BlockMultiBalances
                  balance={tokenBalance?.amount ?? 0n}
                  decimals={tokenBalance?.decimals ?? 0}
                  handleClick={() => {
                    if (tokenBalance != null) {
                      formValuesRef.trigger.updateAmount({
                        value: formatTokenValue(
                          tokenBalance.amount,
                          tokenBalance.decimals
                        ),
                      })
                    }
                  }}
                  disabled={tokenBalance?.amount === 0n}
                  className={clsx(
                    "!static",
                    tokenBalance == null && "invisible"
                  )}
                />
              }
              priceSlot={
                <TokenAmountInputCard.DisplayPrice>
                  {usdAmount !== null && usdAmount > 0
                    ? formatUsdAmount(usdAmount)
                    : null}
                </TokenAmountInputCard.DisplayPrice>
              }
            />
          </div>
          <div className="w-full mt-4">
            <GiftMessageInput
              inputSlot={
                <GiftMessageInput.Input
                  id="gift-message"
                  name="message"
                  value={formValues.message}
                  onChange={(e) =>
                    formValuesRef.trigger.updateMessage({
                      value: e.target.value,
                    })
                  }
                />
              }
            />
          </div>
        </div>

        <ButtonCustom
          type="submit"
          size="lg"
          variant={rootSnapshot.matches("signing") ? "secondary" : "primary"}
          isLoading={rootSnapshot.matches("signing")}
        >
          {rootSnapshot.matches("editing")
            ? "Create gift link"
            : "Confirm transaction in your wallet..."}
        </ButtonCustom>
      </form>
    </div>
  )
}
