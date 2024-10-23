import { useEffect, useRef, useState } from "react"
import { useFormContext } from "react-hook-form"

import { ButtonCustom, ButtonSwitch } from "../../../components/Button"
import { Form } from "../../../components/Form"
import { FieldComboInput } from "../../../components/Form/FieldComboInput"
import { WarnBox } from "../../../components/WarnBox"
import { NEAR_TOKEN_META } from "../../../constants"
import type { SwappableToken } from "../../../types"
import { SwapUIMachineContext } from "./SwapUIMachineProvider"

export type SwapFormValues = {
  amountIn: string // tokenIn
  amountOut: string // tokenOut
}

type SwapFormAsset = {
  tokenIn: string // selectTokenIn
  tokenOut: string // selectTokenOut
}

export type OnSubmitValues = SwapFormValues & SwapFormAsset

enum ErrorEnum {
  INSUFFICIENT_BALANCE = "Insufficient Balance",
  NO_QUOTES = "No Quotes",
  EXCEED_MAX_SLIPPAGE = "Exceed Max Slippage",
}

export interface SwapFormProps {
  userAddress: string | null
  selectTokenIn?: SwappableToken
  selectTokenOut?: SwappableToken
  onSelect: (fieldName: string, selectToken: SwappableToken | undefined) => void
  onSwitch: (e: React.MouseEvent<HTMLButtonElement>) => void
  isFetching: boolean
}

export const SwapForm = ({
  userAddress,
  selectTokenIn,
  selectTokenOut,
  onSelect,
  onSwitch,
  isFetching,
}: SwapFormProps) => {
  const {
    handleSubmit,
    register,
    setValue,
    formState: { errors },
  } = useFormContext<SwapFormValues>()

  const swapUIActorRef = SwapUIMachineContext.useActorRef()

  const allowableNearAmountRef = useRef<null | string>(null)

  const [errorSelectTokenIn, setErrorSelectTokenIn] = useState("")
  const [errorSelectTokenOut, setErrorSelectTokenOut] = useState("")
  const [errorMsg, setErrorMsg] = useState<ErrorEnum>()

  const handleSwitch = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()

    swapUIActorRef.send({
      type: "input",
      params: {
        tokenIn: selectTokenOut,
        tokenOut: selectTokenIn,
      },
    })

    onSwitch(e)
    setValue("amountOut", "")
    setValue("amountIn", "")
  }

  useEffect(() => {
    swapUIActorRef.subscribe((state) => {
      console.log(state.value, state.context)
    })
  }, [swapUIActorRef])

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
          errorSelect={errorSelectTokenIn}
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
          errorSelect={errorSelectTokenOut}
          disabled={true}
        />
        {/*
        {selectTokenIn?.defuseAssetId === NEAR_TOKEN_META.defuseAssetId &&
          errorMsg !== ErrorEnum.INSUFFICIENT_BALANCE &&
          errorMsg !== ErrorEnum.NO_QUOTES && (
            <WarnBox
              allowableNearAmount={allowableNearAmountRef.current}
              balance={selectTokenIn?.balance ?? "0"}
              decimals={selectTokenIn?.decimals ?? 0}
              setValue={(value: string) => {
                setValue("amountIn", value)
              }}
            />
          )}
        */}
        <ButtonCustom
          type="submit"
          size="lg"
          fullWidth
          isLoading={isFetching}
          disabled={Boolean(errorMsg)}
        >
          {isFetching ? "" : errorMsg ? errorMsg : "Swap"}
        </ButtonCustom>
      </Form>
    </div>
  )
}
