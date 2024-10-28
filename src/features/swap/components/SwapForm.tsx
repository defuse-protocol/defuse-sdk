import { useContext, useEffect } from "react"
import { useFormContext } from "react-hook-form"
import { ButtonCustom, ButtonSwitch } from "../../../components/Button"
import { Form } from "../../../components/Form"
import { FieldComboInput } from "../../../components/Form/FieldComboInput"
import type { ModalSelectAssetsPayload } from "../../../components/Modal/ModalSelectAssets"
import { useModalStore } from "../../../providers/ModalStoreProvider"
import { ModalType } from "../../../stores/modalStore"
import type { SwappableToken } from "../../../types"
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
  const intentOutcome = snapshot.context.outcome

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

        {renderIntentOutcome(intentOutcome)}

        <ButtonCustom
          type="submit"
          size="lg"
          fullWidth
          isLoading={snapshot.matches("submitting")}
        >
          Swap
        </ButtonCustom>
      </Form>
    </div>
  )
}

function renderIntentOutcome(intentOutcome: Context["outcome"]) {
  if (!intentOutcome) {
    return null
  }

  const status = intentOutcome.status
  switch (status) {
    case "SETTLED":
      return null

    case "NOT_FOUND_OR_NOT_VALID":
      return (
        <div className="text-red-500 text-sm">
          Missed deadline or don't have enough funds!
          {intentOutcome.txHash == null ? null : (
            <>
              <br />
              Tx: {intentOutcome.txHash}
            </>
          )}
          {intentOutcome.intentHash == null ? null : (
            <>
              <br />
              Intent: {intentOutcome.intentHash}
            </>
          )}
        </div>
      )

    case "ERR_CANNOT_OBTAIN_INTENT_STATUS":
      return (
        <div className="text-red-500 text-sm">
          Cannot confirm intent status! Tx: {intentOutcome.txHash} Intent:{" "}
          {intentOutcome.intentHash}
        </div>
      )

    default:
      return <div className="text-red-500 text-sm">Swap failed! {status}</div>
  }
}
