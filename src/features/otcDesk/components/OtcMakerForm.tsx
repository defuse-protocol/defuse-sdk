import { ArrowsDownUp } from "@phosphor-icons/react"
import { useActorRef, useSelector } from "@xstate/react"
import clsx from "clsx"
import { useEffect, useMemo } from "react"
import type { ModalSelectAssetsPayload } from "src/components/Modal/ModalSelectAssets"
import type { ActorRefFrom, SnapshotFrom } from "xstate"
import { BlockMultiBalances } from "../../../components/Block/BlockMultiBalances"
import { ButtonCustom } from "../../../components/Button/ButtonCustom"
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
import type { otcMakerConfigLoadActor } from "../actors/otcMakerConfigLoadActor"
import { formValuesSelector } from "../actors/otcMakerFormMachine"
import type { otcMakerReadyOrderActor } from "../actors/otcMakerReadyOrderActor"
import { otcMakerRootMachine } from "../actors/otcMakerRootMachine"
import type { SignMessage } from "../types/sharedTypes"
import { OtcMakerReadyOrderDialog } from "./OtcMakerReadyOrderDialog"

export type OtcMakerWidgetProps = {
  /** List of available tokens for trading */
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]

  /** User's wallet address */
  userAddress: string | null | undefined
  userChainType: ChainType | null | undefined

  /** Initial tokens for pre-filling the form */
  initialTokenIn?: BaseTokenInfo | UnifiedTokenInfo
  initialTokenOut?: BaseTokenInfo | UnifiedTokenInfo

  /** Sign message callback */
  signMessage: SignMessage

  /** Function to generate a shareable trade link */
  generateLink: (multiPayload: MultiPayload) => string

  /** Theme selection */
  theme?: "dark" | "light"
}

export function OtcMakerForm({
  tokenList,
  userAddress,
  userChainType,
  initialTokenIn,
  initialTokenOut,
  signMessage,
  generateLink,
}: OtcMakerWidgetProps) {
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
  const initialTokenOut_ = initialTokenOut ?? tokenList[1]
  assert(initialTokenIn_ !== undefined, "Token list must not be empty")
  assert(
    initialTokenOut_ !== undefined,
    "Token list must have at least two tokens"
  )

  const rootActorRef = useActorRef(otcMakerRootMachine, {
    input: {
      initialTokenIn: initialTokenIn_,
      initialTokenOut: initialTokenOut_,
      tokenList,
    },
  })

  const formRef = useSelector(rootActorRef, (s) => s.context.formRef)
  const formValuesRef = useSelector(formRef, formValuesSelector)
  const formValues = useSelector(formValuesRef, (s) => s.context)

  const { tokenInBalance, tokenOutBalance } = useSelector(
    useSelector(rootActorRef, (s) => s.context.depositedBalanceRef),
    balanceAllSelector({
      tokenInBalance: formValues.tokenIn,
      tokenOutBalance: formValues.tokenOut,
    })
  )

  const rootSnapshot = useSelector(rootActorRef, (s) => s)
  const { configRef, readyOrderRef } = useSelector(rootActorRef, (s) => ({
    configRef: s.context.otcMakerConfigLoadRef as unknown as
      | undefined
      | ActorRefFrom<typeof otcMakerConfigLoadActor>,
    readyOrderRef: s.children.readyOrderRef as unknown as
      | undefined
      | ActorRefFrom<typeof otcMakerReadyOrderActor>,
  }))

  const { data: tokensUsdPriceData } = useTokensUsdPrices()
  const usdAmountIn = getTokenUsdPrice(
    formValues.amountIn,
    formValues.tokenIn,
    tokensUsdPriceData
  )
  const usdAmountOut = getTokenUsdPrice(
    formValues.amountOut,
    formValues.tokenOut,
    tokensUsdPriceData
  )

  useEffect(() => {
    if (signerCredentials == null) {
      rootActorRef.send({ type: "LOGOUT" })
    } else {
      rootActorRef.send({
        type: "LOGIN",
        params: {
          userAddress: signerCredentials.credential,
          userChainType: signerCredentials.credentialType,
        },
      })
    }
  }, [rootActorRef, signerCredentials])

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
      balances: fieldName === "tokenIn" ? tokenInBalance : tokenOutBalance,
    })
  }

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

      switch (payload.fieldName) {
        case "tokenIn":
          if (formValues.tokenOut === token && formValues.tokenIn !== null) {
            formValuesRef.trigger.updateTokenOut({
              value: formValues.tokenIn,
            })
          }
          formValuesRef.trigger.updateTokenIn({ value: token })
          break
        case "tokenOut":
          if (formValues.tokenIn === token && formValues.tokenOut !== null) {
            formValuesRef.trigger.updateTokenIn({
              value: formValues.tokenOut,
            })
          }
          formValuesRef.trigger.updateTokenOut({ value: token })
          break
        default:
          throw new Error("Invalid field name")
      }
    }
  }, [
    modalSelectAssetsData,
    formValues.tokenIn,
    formValues.tokenOut,
    formValuesRef.trigger.updateTokenIn,
    formValuesRef.trigger.updateTokenOut,
  ])

  return (
    <>
      {useSelector(
        useSelector(rootActorRef, (s) => s.children.otcMakerConfigLoadRef),
        (s) => JSON.stringify(s?.context)
      )}

      {rootSnapshot.matches("signed") &&
        configRef != null &&
        readyOrderRef != null &&
        signerCredentials != null && (
          <OtcMakerReadyOrderDialog
            configRef={configRef}
            readyOrderRef={readyOrderRef}
            signerCredentials={signerCredentials}
            signMessage={signMessage}
            generateLink={generateLink}
          />
        )}

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
            <label
              htmlFor="otc-maker-amount-in"
              className="font-bold text-label text-sm"
            >
              Sell
            </label>
            <TokenAmountInputCard
              inputSlot={
                <TokenAmountInputCard.Input
                  id="otc-maker-amount-in"
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

          <button
            type="button"
            // mousedown event is used to prevent the button from stealing focus
            onMouseDown={(e) => {
              e.preventDefault()
              formValuesRef.trigger.switchTokens()
            }}
            className="size-10 -my-3.5 rounded-lg bg-gray-50 flex items-center justify-center"
          >
            <ArrowsDownUp className="size-5" />
          </button>

          <div className="flex flex-col gap-3">
            <label
              htmlFor="otc-maker-amount-out"
              className="font-bold text-label text-sm"
            >
              Buy
            </label>
            <TokenAmountInputCard
              inputSlot={
                <TokenAmountInputCard.Input
                  id="otc-maker-amount-out"
                  name="amountOut"
                  value={formValues.amountOut}
                  onChange={(e) =>
                    formValuesRef.trigger.updateAmountOut({
                      value: e.target.value,
                    })
                  }
                />
              }
              tokenSlot={
                <SelectAssets
                  selected={formValues.tokenOut ?? undefined}
                  handleSelect={() => handleSelect("tokenOut")}
                />
              }
              balanceSlot={
                <BlockMultiBalances
                  balance={tokenOutBalance?.amount ?? 0n}
                  decimals={tokenOutBalance?.decimals ?? 0}
                  handleClick={() => {
                    if (tokenOutBalance != null) {
                      formValuesRef.trigger.updateAmountOut({
                        value: formatTokenValue(
                          tokenOutBalance.amount,
                          tokenOutBalance.decimals
                        ),
                      })
                    }
                  }}
                  disabled={tokenOutBalance?.amount === 0n}
                  className={clsx(
                    "!static",
                    tokenOutBalance == null && "invisible"
                  )}
                />
              }
              priceSlot={
                <TokenAmountInputCard.DisplayPrice>
                  {usdAmountOut !== null && usdAmountOut > 0
                    ? formatUsdAmount(usdAmountOut)
                    : null}
                </TokenAmountInputCard.DisplayPrice>
              }
            />
          </div>
        </div>

        {renderSubmitButton(rootSnapshot)}
      </form>
    </>
  )
}

function renderSubmitButton(
  snapshot: SnapshotFrom<typeof otcMakerRootMachine>
) {
  let caption = "Create swap link"

  switch (true) {
    case snapshot.matches("editing"):
      caption = "Create swap link"
      break
    case snapshot.matches("signing"):
      caption = "Confirm in your wallet..."
      break
    case snapshot.matches("signed"):
      caption = "Swap link created!"
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
