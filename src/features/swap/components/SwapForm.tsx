import { useEffect } from "react"
import { useFormContext } from "react-hook-form"
import { ButtonCustom, ButtonSwitch } from "../../../components/Button"
import { Form } from "../../../components/Form"
import { FieldComboInput } from "../../../components/Form/FieldComboInput"
import type { ModalSelectAssetsPayload } from "../../../components/Modal/ModalSelectAssets"
import { useModalStore } from "../../../providers/ModalStoreProvider"
import { ModalType } from "../../../stores/modalStore"
import type { SwappableToken } from "../../../types"
import { SwapUIMachineContext } from "./SwapUIMachineProvider"

export type SwapFormValues = {
  amountIn: string
  amountOut: string
}

export interface SwapFormProps {
  userAddress: string | null
}

export const SwapForm = ({ userAddress }: SwapFormProps) => {
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useFormContext<SwapFormValues>()

  const swapUIActorRef = SwapUIMachineContext.useActorRef()

  const { tokenIn: selectTokenIn, tokenOut: selectTokenOut } =
    SwapUIMachineContext.useSelector((snapshot) => snapshot.context.formValues)

  const handleSwitch = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()

    swapUIActorRef.send({
      type: "input",
      params: {
        tokenIn: selectTokenOut,
        tokenOut: selectTokenIn,
      },
    })
  }

  const { setModalType, payload, onCloseModal } = useModalStore(
    (state) => state
  )

  const onSelect = (
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

  return (
    <div className="md:max-w-[472px] rounded-[1rem] p-5 shadow-paper bg-white dark:shadow-paper-dark dark:bg-black-800">
      <Form<SwapFormValues>
        handleSubmit={handleSubmit(() => {
          if (userAddress != null) {
            swapUIActorRef.send({ type: "submit", params: { userAddress } })
          } else {
            console.warn("User address is not authenticated")
          }
        })}
        register={register}
      >
        <FieldComboInput<SwapFormValues>
          fieldName="amountIn"
          selected={selectTokenIn}
          handleSelect={() => {
            onSelect("tokenIn", selectTokenOut)
          }}
          className="border rounded-t-xl"
          required="This field is required"
          errors={errors}
        />

        <div className="relative w-full">
          <ButtonSwitch onClick={handleSwitch} />
        </div>

        <FieldComboInput<SwapFormValues>
          fieldName="amountOut"
          selected={selectTokenOut}
          handleSelect={() => {
            onSelect("tokenOut", selectTokenIn)
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
