import { useSelector } from "@xstate/react"
import { Fragment, useContext, useEffect } from "react"
import { useFormContext } from "react-hook-form"
import { formatUnits } from "viem"
import type { ActorRefFrom } from "xstate"
import { ButtonCustom, ButtonSwitch } from "../../../components/Button"
import { Form } from "../../../components/Form"
import { FieldComboInput } from "../../../components/Form/FieldComboInput"
import type { ModalSelectAssetsPayload } from "../../../components/Modal/ModalSelectAssets"
import { useModalStore } from "../../../providers/ModalStoreProvider"
import { ModalType } from "../../../stores/modalStore"
import type { SwappableToken } from "../../../types"
import type { intentStatusMachine } from "../../machines/intentStatusMachine"
import type { Context } from "../../machines/swapUIMachine"
import { SwapSubmitterContext } from "./SwapSubmitter"
import { SwapUIMachineContext } from "./SwapUIMachineProvider"

export type SwapFormValues = {
  amountIn: string
  amountOut: string
}

export const SwapForm = () => {
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useFormContext<SwapFormValues>()

  const swapUIActorRef = SwapUIMachineContext.useActorRef()
  const snapshot = SwapUIMachineContext.useSelector((snapshot) => snapshot)
  const intentCreationResult = snapshot.context.intentCreationResult

  const { tokenIn, tokenOut } = SwapUIMachineContext.useSelector(
    (snapshot) => snapshot.context.formValues
  )

  const switchTokens = () => {
    swapUIActorRef.send({
      type: "input",
      params: {
        tokenIn: tokenOut,
        tokenOut: tokenIn,
      },
    })
  }

  const { setModalType, payload, onCloseModal } = useModalStore(
    (state) => state
  )

  const openModalSelectAssets = (
    fieldName: string,
    selectToken: SwappableToken | undefined
  ) => {
    setModalType(ModalType.MODAL_SELECT_ASSETS, { fieldName, selectToken })
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
      switch (fieldName) {
        case "tokenIn":
          swapUIActorRef.send({ type: "input", params: { tokenIn: token } })
          break
        case "tokenOut":
          swapUIActorRef.send({ type: "input", params: { tokenOut: token } })
          break
      }
      onCloseModal(undefined)
    }
  }, [payload, onCloseModal, swapUIActorRef])

  const { onSubmit } = useContext(SwapSubmitterContext)

  return (
    <div className="md:max-w-[472px] rounded-[1rem] p-5 shadow-paper bg-white dark:shadow-paper-dark dark:bg-black-800">
      <Form<SwapFormValues>
        handleSubmit={handleSubmit(onSubmit)}
        register={register}
      >
        <FieldComboInput<SwapFormValues>
          fieldName="amountIn"
          selected={tokenIn}
          handleSelect={() => {
            openModalSelectAssets("tokenIn", tokenOut)
          }}
          className="border rounded-t-xl"
          required="This field is required"
          errors={errors}
        />

        <div className="relative w-full">
          <ButtonSwitch onClick={switchTokens} />
        </div>

        <FieldComboInput<SwapFormValues>
          fieldName="amountOut"
          selected={tokenOut}
          handleSelect={() => {
            openModalSelectAssets("tokenOut", tokenIn)
          }}
          className="border rounded-b-xl mb-5"
          required="This field is required"
          errors={errors}
          disabled={true}
        />

        {renderIntentCreationResult(intentCreationResult)}

        <ButtonCustom
          type="submit"
          size="lg"
          fullWidth
          isLoading={snapshot.matches("submitting")}
        >
          Swap
        </ButtonCustom>
      </Form>

      <Intents intentRefs={snapshot.context.intentRefs} />
    </div>
  )
}

function Intents({
  intentRefs,
}: { intentRefs: ActorRefFrom<typeof intentStatusMachine>[] }) {
  return (
    <div>
      {intentRefs.map((intentRef, i, list) => {
        return (
          <Fragment key={intentRef.id}>
            <Intent intentRef={intentRef} />
            {i < list.length - 1 && <hr />}
          </Fragment>
        )
      })}
    </div>
  )
}

function Intent({
  intentRef,
}: { intentRef: ActorRefFrom<typeof intentStatusMachine> }) {
  const snapshot = useSelector(intentRef, (state) => state)

  const amountIn = formatUnits(
    snapshot.context.quote.totalAmountIn,
    snapshot.context.tokenIn.decimals
  )
  const amountOut = formatUnits(
    snapshot.context.quote.totalAmountOut,
    snapshot.context.tokenOut.decimals
  )

  const swapInfo = `${amountIn} ${snapshot.context.tokenIn.symbol} -> ${amountOut} ${snapshot.context.tokenOut.symbol}`

  const value = snapshot.value
  switch (value) {
    case "pending":
      return (
        <div>
          {swapInfo} 💤
          <br />
          Checking intent status... intentHash: {snapshot.context.intentHash}
        </div>
      )
    case "checking":
      return (
        <div>
          {swapInfo} 💤
          <br />
          Checking intent status... intentHash: {snapshot.context.intentHash}{" "}
          tx: {snapshot.context.txHash}
        </div>
      )
    case "success":
      return (
        <div>
          {swapInfo} ✅
          <br />
          Intent settled! tx: {snapshot.context.txHash}
        </div>
      )
    case "not_valid":
      return (
        <div>
          {swapInfo} ❌
          <br />
          Intent not valid! tx: {snapshot.context.txHash} intent:{" "}
          {snapshot.context.intentHash}
        </div>
      )
    case "error":
      return (
        <div>
          {swapInfo} 😓
          <br />
          Error checking intent status! tx: {snapshot.context.txHash} intent:{" "}
          {snapshot.context.intentHash}
          <button
            type={"button"}
            onClick={() => intentRef.send({ type: "RETRY" })}
          >
            retry
          </button>
        </div>
      )
    default:
      value satisfies never
      return null
  }
}

function renderIntentCreationResult(
  intentCreationResult: Context["intentCreationResult"]
) {
  if (!intentCreationResult) {
    return null
  }

  const status = intentCreationResult.status
  switch (status) {
    case "INTENT_PUBLISHED":
      return null

    case "ERR_QUOTE_EXPIRED_RETURN_IS_LOWER":
      return <div className="text-red-500 text-sm">Missed deadline</div>

    case "ERR_CANNOT_PUBLISH_INTENT":
      return <div className="text-red-500 text-sm">Cannot publish intent</div>

    default:
      return <div className="text-red-500 text-sm">Swap failed! {status}</div>
  }
}
