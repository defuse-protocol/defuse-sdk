import { useActorRef, useSelector } from "@xstate/react"
import clsx from "clsx"
import { useEffect, useMemo } from "react"
import type { SnapshotFrom } from "xstate"
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
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import type { ChainType } from "../../../types/deposit"
import { assert } from "../../../utils/assert"
import { formatTokenValue, formatUsdAmount } from "../../../utils/format"
import getTokenUsdPrice from "../../../utils/getTokenUsdPrice"
import { TokenAmountInputCard } from "../../deposit/components/DepositForm/TokenAmountInputCard"
import { balanceAllSelector } from "../../machines/depositedBalanceMachine"
import type { SendNearTransaction } from "../../machines/publicKeyVerifierMachine"
import { formValuesSelector } from "../actors/giftFormMachine"
import { giftRootMachine } from "../actors/giftRootMachine"
import type { SignMessage } from "../types/sharedTypes"

export type GiftWidgetProps = {
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
  generateLink: (multiPayload: MultiPayload) => string

  /** Theme selection */
  theme?: "dark" | "light"

  /** Frontend referral */
  referral?: string
}

export function GiftForm({
  tokenList,
  userAddress,
  userChainType,
  initialTokenIn,
  signMessage,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  sendNearTransaction,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  generateLink,
  referral,
}: GiftWidgetProps) {
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

  const rootActorRef = useActorRef(giftRootMachine, {
    input: {
      initialTokenIn: initialTokenIn_,
      tokenList,
      referral,
    },
  })

  const formRef = useSelector(rootActorRef, (s) => s.context.formRef)
  const formValuesRef = useSelector(formRef, formValuesSelector)
  const formValues = useSelector(formValuesRef, (s) => s.context)

  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  const { tokenInBalance } = useSelector(
    useSelector(rootActorRef, (s) => s.context.depositedBalanceRef),
    balanceAllSelector({
      tokenInBalance: formValues.tokenIn,
    })
  )

  const rootSnapshot = useSelector(rootActorRef, (s) => s)

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
  const usdAmountIn = getTokenUsdPrice(
    formValues.amountIn,
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
    <div className="flex flex-col p-5">
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
                  Sell
                </label>
              }
              inputSlot={
                <TokenAmountInputCard.Input
                  id="gift-amount-in"
                  name="amountIn"
                  value={formValues.amountIn}
                  onChange={(e) =>
                    formValuesRef.trigger.updateAmountIn({
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
                      formValuesRef.trigger.updateAmountIn({
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
                  {usdAmountIn !== null && usdAmountIn > 0
                    ? formatUsdAmount(usdAmountIn)
                    : null}
                </TokenAmountInputCard.DisplayPrice>
              }
            />
          </div>
          {renderSubmitButton(rootSnapshot)}
        </div>
      </form>
    </div>
  )
}

function renderSubmitButton(snapshot: SnapshotFrom<typeof giftRootMachine>) {
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
