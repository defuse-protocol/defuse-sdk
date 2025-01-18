import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Box, Callout, Flex } from "@radix-ui/themes"
import { useSelector } from "@xstate/react"
import {
  Fragment,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
} from "react"
import { useFormContext } from "react-hook-form"
import { useTokensUsdPrices } from "src/hooks/useTokensUsdPrices"
import { formatUsdAmount } from "src/utils/format"
import getTokenUsdPrice from "src/utils/getTokenUsdPrice"
import type { ActorRefFrom, SnapshotFrom } from "xstate"
import { ButtonCustom } from "../../../components/Button/ButtonCustom"
import { ButtonSwitch } from "../../../components/Button/ButtonSwitch"
import { Form } from "../../../components/Form"
import { FieldComboInput } from "../../../components/Form/FieldComboInput"
import { SwapIntentCard } from "../../../components/IntentCard/SwapIntentCard"
import type { ModalSelectAssetsPayload } from "../../../components/Modal/ModalSelectAssets"
import { useModalStore } from "../../../providers/ModalStoreProvider"
import { isAggregatedQuoteEmpty } from "../../../services/quoteService"
import { ModalType } from "../../../stores/modalStore"
import type { SwappableToken } from "../../../types/swap"
import { computeTotalBalance } from "../../../utils/tokenUtils"
import type { depositedBalanceMachine } from "../../machines/depositedBalanceMachine"
import type { intentStatusMachine } from "../../machines/intentStatusMachine"
import type { Context } from "../../machines/swapUIMachine"
import { SwapSubmitterContext } from "./SwapSubmitter"
import { SwapUIMachineContext } from "./SwapUIMachineProvider"

export type SwapFormValues = {
  amountIn: string
  amountOut: string
}

export interface SwapFormProps {
  onNavigateDeposit?: () => void
}

export const SwapForm = ({ onNavigateDeposit }: SwapFormProps) => {
  const {
    handleSubmit,
    register,
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext<SwapFormValues>()

  const swapUIActorRef = SwapUIMachineContext.useActorRef()
  const snapshot = SwapUIMachineContext.useSelector((snapshot) => snapshot)
  const intentCreationResult = snapshot.context.intentCreationResult
  const { data: tokensUsdPriceData } = useTokensUsdPrices()

  const { tokenIn, tokenOut, noLiquidity } = SwapUIMachineContext.useSelector(
    (snapshot) => {
      const tokenIn = snapshot.context.formValues.tokenIn
      const tokenOut = snapshot.context.formValues.tokenOut
      const noLiquidity =
        snapshot.context.quote && isAggregatedQuoteEmpty(snapshot.context.quote)

      return {
        tokenIn,
        tokenOut,
        noLiquidity,
      }
    }
  )

  // we need stable references to allow passing to useEffect
  const switchTokens = useCallback(() => {
    const { amountIn, amountOut } = getValues()
    setValue("amountIn", amountOut)
    setValue("amountOut", amountIn)
    swapUIActorRef.send({
      type: "input",
      params: {
        tokenIn: tokenOut,
        tokenOut: tokenIn,
      },
    })
  }, [tokenIn, tokenOut, getValues, setValue, swapUIActorRef.send])

  const { setModalType, payload, onCloseModal } = useModalStore(
    (state) => state
  )

  const openModalSelectAssets = (fieldName: string) => {
    setModalType(ModalType.MODAL_SELECT_ASSETS, {
      fieldName,
      selectToken: undefined,
      balances: depositedBalanceRef?.getSnapshot().context.balances,
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
      const { tokenIn, tokenOut } =
        swapUIActorRef.getSnapshot().context.formValues

      switch (fieldName) {
        case "tokenIn":
          if (tokenOut === token) {
            // Don't need to switch amounts, when token selected from dialog
            swapUIActorRef.send({
              type: "input",
              params: { tokenIn: tokenOut, tokenOut: tokenIn },
            })
          } else {
            swapUIActorRef.send({ type: "input", params: { tokenIn: token } })
          }
          break
        case "tokenOut":
          if (tokenIn === token) {
            // Don't need to switch amounts, when token selected from dialog
            swapUIActorRef.send({
              type: "input",
              params: { tokenIn: tokenOut, tokenOut: tokenIn },
            })
          } else {
            swapUIActorRef.send({ type: "input", params: { tokenOut: token } })
          }
          break
      }
      onCloseModal(undefined)
    }
  }, [payload, onCloseModal, swapUIActorRef])

  const { onSubmit } = useContext(SwapSubmitterContext)

  const depositedBalanceRef = useSelector(
    swapUIActorRef,
    (state) => state.children.depositedBalanceRef
  )

  const tokenInBalance = useSelector(
    depositedBalanceRef,
    balanceSelector(tokenIn)
  )

  const tokenOutBalance = useSelector(
    depositedBalanceRef,
    balanceSelector(tokenOut)
  )

  const balanceInsufficient =
    tokenInBalance != null && snapshot.context.parsedFormValues.amountIn != null
      ? tokenInBalance < snapshot.context.parsedFormValues.amountIn
      : null

  const showDepositButton =
    tokenInBalance != null && tokenInBalance === 0n && onNavigateDeposit != null

  const usdAmountIn = getTokenUsdPrice(
    getValues().amountIn,
    tokenIn,
    tokensUsdPriceData
  )
  const usdAmountOut = getTokenUsdPrice(
    getValues().amountOut,
    tokenOut,
    tokensUsdPriceData
  )

  return (
    <Flex
      direction="column"
      gap="2"
      className="widget-container rounded-2xl bg-gray-1 p-5 shadow"
    >
      <Form<SwapFormValues>
        handleSubmit={handleSubmit(onSubmit)}
        register={register}
      >
        <FieldComboInput<SwapFormValues>
          fieldName="amountIn"
          selected={tokenIn}
          handleSelect={() => {
            openModalSelectAssets("tokenIn")
          }}
          className="border border-gray-200/50 rounded-t-xl"
          required
          errors={errors}
          usdAmount={usdAmountIn ? `~${formatUsdAmount(usdAmountIn)}` : null}
          balance={tokenInBalance}
        />

        <div className="relative w-full">
          <ButtonSwitch onClick={switchTokens} />
        </div>

        <FieldComboInput<SwapFormValues>
          fieldName="amountOut"
          selected={tokenOut}
          handleSelect={() => {
            openModalSelectAssets("tokenOut")
          }}
          className="border border-gray-200/50 rounded-b-xl mb-5"
          errors={errors}
          disabled={true}
          isLoading={snapshot.matches({ editing: "waiting_quote" })}
          usdAmount={usdAmountOut ? `~${formatUsdAmount(usdAmountOut)}` : null}
          balance={tokenOutBalance}
        />

        <Flex align="stretch" direction="column">
          {showDepositButton ? (
            <ButtonCustom
              type="button"
              size="lg"
              fullWidth
              onClick={() => {
                onNavigateDeposit()
              }}
            >
              Go to Deposit
            </ButtonCustom>
          ) : (
            <ButtonCustom
              type="submit"
              size="lg"
              fullWidth
              isLoading={snapshot.matches("submitting")}
              disabled={!!balanceInsufficient || !!noLiquidity}
            >
              {noLiquidity
                ? "No liquidity providers"
                : balanceInsufficient
                  ? "Insufficient Balance"
                  : "Swap"}
            </ButtonCustom>
          )}
        </Flex>
      </Form>

      {renderIntentCreationResult(intentCreationResult)}

      <Box>
        <Intents intentRefs={snapshot.context.intentRefs} />
      </Box>
    </Flex>
  )
}

function Intents({
  intentRefs,
}: { intentRefs: ActorRefFrom<typeof intentStatusMachine>[] }) {
  return (
    <div>
      {intentRefs.map((intentRef) => {
        return (
          <Fragment key={intentRef.id}>
            <SwapIntentCard intentStatusActorRef={intentRef} />
          </Fragment>
        )
      })}
    </div>
  )
}

export function renderIntentCreationResult(
  intentCreationResult: Context["intentCreationResult"]
) {
  if (!intentCreationResult || intentCreationResult.tag === "ok") {
    return null
  }

  let content: ReactNode = null

  const status = intentCreationResult.value.reason
  switch (status) {
    case "ERR_USER_DIDNT_SIGN":
      content =
        "It seems the message wasn’t signed in your wallet. Please try again."
      break

    case "ERR_CANNOT_VERIFY_SIGNATURE":
      content =
        "We couldn’t verify your signature, please try again with another wallet."
      break

    case "ERR_SIGNED_DIFFERENT_ACCOUNT":
      content =
        "The message was signed with a different wallet. Please try again."
      break

    case "ERR_PUBKEY_ADDING_DECLINED":
      content = null
      break

    case "ERR_PUBKEY_CHECK_FAILED":
      content =
        "We couldn’t verify your key, possibly due to a connection issue."
      break

    case "ERR_PUBKEY_ADDING_FAILED":
      content = "Transaction for adding public key is failed. Please try again."
      break

    case "ERR_PUBKEY_EXCEPTION":
      content = "An error occurred while adding public key. Please try again."
      break

    case "ERR_QUOTE_EXPIRED_RETURN_IS_LOWER":
      content =
        "The quote has expired or the return is lower than expected. Please try again."
      break

    case "ERR_CANNOT_PUBLISH_INTENT":
      content =
        "We couldn’t send your request, possibly due to a network issue or server downtime. Please check your connection or try again later."
      break

    case "ERR_WALLET_POPUP_BLOCKED":
      content = "Please allow popups and try again."
      break

    case "ERR_WALLET_CANCEL_ACTION":
      content = null
      break

    default:
      status satisfies never
      content = `An error occurred. Please try again. ${status}`
  }

  if (content == null) {
    return null
  }

  return (
    <Callout.Root size="1" color="red">
      <Callout.Icon>
        <ExclamationTriangleIcon />
      </Callout.Icon>
      <Callout.Text>{content}</Callout.Text>
    </Callout.Root>
  )
}

export function balanceSelector(token: SwappableToken) {
  return (state: undefined | SnapshotFrom<typeof depositedBalanceMachine>) => {
    if (!state) return
    return computeTotalBalance(token, state.context.balances)
  }
}
