import { useContext, useEffect } from "react"
import { useFormContext } from "react-hook-form"
import { ButtonCustom, ButtonSwitch } from "../../../components/Button"
import { Form } from "../../../components/Form"
import { FieldComboInput } from "../../../components/Form/FieldComboInput"
import type { ModalSelectAssetsPayload } from "../../../components/Modal/ModalSelectAssets"
import { useModalStore } from "../../../providers/ModalStoreProvider"
import { ModalType } from "../../../stores/modalStore"
import type { SwappableToken } from "../../../types"
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

        <ButtonCustom type="submit" size="lg" fullWidth>
          Swap
        </ButtonCustom>
      </Form>
    </div>
  )
}
