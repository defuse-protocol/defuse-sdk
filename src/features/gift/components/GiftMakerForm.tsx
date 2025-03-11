import { useActorRef, useSelector } from "@xstate/react"
import clsx from "clsx"
import { useEffect, useMemo } from "react"
import type { ActorRefFrom, SnapshotFrom } from "xstate"
import { BlockMultiBalances } from "../../../components/Block/BlockMultiBalances"
import { ButtonCustom } from "../../../components/Button/ButtonCustom"
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
import type { SendNearTransaction } from "../../machines/publicKeyVerifierMachine"
import { formValuesSelector } from "../actors/giftMakerFormMachine"
import type { giftMakerReadyActor } from "../actors/giftMakerReadyActor"
import { giftMakerRootMachine } from "../actors/giftMakerRootMachine"
import type { SignMessage } from "../types/sharedTypes"
import { GiftMakerReadyDialog } from "./GiftMakerReadyDialog"
import { GiftMessageInput } from "./GiftMessageInput"

export type GiftMakerWidgetProps = {
  /** List of available tokens for trading */
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]

  /** User's wallet address */
  userAddress: string | null | undefined
  userChainType: ChainType | null | undefined

  /** Initial tokens for pre-filling the form */
  initialTokenIn?: BaseTokenInfo | UnifiedTokenInfo

  /** Sign message callback */
  signMessage: SignMessage

  /** Send NEAR transaction callback */
  sendNearTransaction: SendNearTransaction

  /** Function to generate a shareable trade link */
  generateLink: (secretKey: string) => string

  /** Theme selection */
  theme?: "dark" | "light"

  /** Frontend referral */
  referral?: string
}

export function GiftMakerForm({
  tokenList,
  userAddress,
  userChainType,
  initialTokenIn,
  signMessage,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  sendNearTransaction,
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

  const initialTokenIn_ = initialTokenIn ?? tokenList[0]
  assert(initialTokenIn_ !== undefined, "Token list must not be empty")

  const rootActorRef = useActorRef(giftMakerRootMachine, {
    input: {
      initialTokenIn: initialTokenIn_,
      tokenList,
      referral,
    },
  })

  const formRef = useSelector(rootActorRef, (s) => s.context.formRef)
  const formValuesRef = useSelector(formRef, formValuesSelector)
  const formValues = useSelector(formValuesRef, (s) => s.context)

  const { tokenInBalance } = useSelector(
    useSelector(rootActorRef, (s) => s.context.depositedBalanceRef),
    balanceAllSelector({
      tokenInBalance: formValues.tokenIn,
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
  }>(ModalType.MODAL_SELECT_ASSETS, "token")

  const updateTokens = useTokensStore((state) => state.updateTokens)

  const handleSelect = (fieldName: string) => {
    updateTokens(tokenList)
    setModalType(ModalType.MODAL_SELECT_ASSETS, {
      fieldName,
      selectToken: undefined,
      balances: tokenInBalance,
    })
  }

  const { data: tokensUsdPriceData } = useTokensUsdPrices()
  const usdAmount = getTokenUsdPrice(
    formValues.amount,
    formValues.tokenIn,
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

      formValuesRef.trigger.updateTokenIn({ value: token })
    }
  }, [modalSelectAssetsData, formValuesRef.trigger.updateTokenIn])

  return (
    <div className="flex flex-col">
      {rootSnapshot.matches("signed") &&
        readyGiftRef != null &&
        signerCredentials != null && (
          <GiftMakerReadyDialog
            readyGiftRef={readyGiftRef}
            signerCredentials={signerCredentials}
            signMessage={signMessage}
            generateLink={generateLink}
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
                  selected={formValues.tokenIn ?? undefined}
                  handleSelect={() => handleSelect("tokenIn")}
                />
              }
              balanceSlot={
                <BlockMultiBalances
                  balance={tokenInBalance?.amount ?? 0n}
                  decimals={tokenInBalance?.decimals ?? 0}
                  handleClick={() => {
                    if (tokenInBalance != null) {
                      formValuesRef.trigger.updateAmount({
                        value: formatTokenValue(
                          tokenInBalance.amount,
                          tokenInBalance.decimals
                        ),
                      })
                    }
                  }}
                  disabled={tokenInBalance?.amount === 0n}
                  className={clsx(
                    "!static",
                    tokenInBalance == null && "invisible"
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

        {renderSubmitButton(rootSnapshot)}
      </form>
    </div>
  )
}

function renderSubmitButton(
  snapshot: SnapshotFrom<typeof giftMakerRootMachine>
) {
  let caption = "Create swap link"

  switch (true) {
    case snapshot.matches("editing"):
      caption = "Create gift link"
      break
    case snapshot.matches("signing"):
      caption = "Confirm transaction in your wallet..."
      break
  }

  return (
    <ButtonCustom
      type="submit"
      size="lg"
      variant={snapshot.matches("signing") ? "secondary" : "primary"}
      isLoading={snapshot.matches("signing")}
    >
      {caption}
    </ButtonCustom>
  )
}
