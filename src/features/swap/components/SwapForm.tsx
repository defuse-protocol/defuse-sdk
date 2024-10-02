import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { quoteMachine } from "@defuse-protocol/swap-facade"
import { createActor } from "xstate"

import { ButtonCustom, ButtonSwitch } from "src/components/Button"
import { Form } from "src/components/Form"
import { FieldComboInput } from "src/components/Form/FieldComboInput"
import { WarnBox } from "src/components/WarnBox"
import { NEAR_TOKEN_META } from "src/constants"
import { BaseTokenInfo } from "src/types/base"

type SwapFormValues = {
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
  selectTokenIn: BaseTokenInfo
  selectTokenOut: BaseTokenInfo
  onSubmit: (values: OnSubmitValues) => void
  onSelect: (fieldName: string, selectToken: BaseTokenInfo) => void
  isFetching: boolean
}

export const SwapForm = ({
  selectTokenIn,
  selectTokenOut,
  onSubmit,
  onSelect,
  isFetching,
}: SwapFormProps) => {
  const {
    handleSubmit,
    register,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SwapFormValues>({ reValidateMode: "onSubmit" })

  const allowableNearAmountRef = useRef<null | string>(null)

  const [errorSelectTokenIn, setErrorSelectTokenIn] = useState("")
  const [errorSelectTokenOut, setErrorSelectTokenOut] = useState("")
  const [errorMsg, setErrorMsg] = useState<ErrorEnum>()

  const quoteActor = createActor(quoteMachine, {
    input: {},
  }).start()

  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name === "amountIn") {
        quoteActor.send({
          type: "SET_PARAMS",
          data: {
            assetIn: selectTokenIn.defuseAssetId,
            assetOut: selectTokenOut.defuseAssetId,
            amountIn: String(value.amountIn),
          },
        })
      }
    })
    return () => subscription.unsubscribe()
  }, [watch, selectTokenIn, selectTokenOut])

  return (
    <Form<SwapFormValues>
      handleSubmit={handleSubmit((values: SwapFormValues) =>
        onSubmit(values as OnSubmitValues)
      )}
      register={register}
    >
      <FieldComboInput<SwapFormValues>
        fieldName="amountIn"
        selected={selectTokenIn}
        handleSelect={() => onSelect("amountIn", selectTokenOut)}
        className="border rounded-t-xl md:max-w-[472px]"
        required="This field is required"
        errors={errors}
        errorSelect={errorSelectTokenIn}
      />
      <div className="relative w-full">
        <ButtonSwitch onClick={() => {}} />
      </div>
      <FieldComboInput<SwapFormValues>
        fieldName="amountOut"
        selected={selectTokenOut as BaseTokenInfo}
        handleSelect={() => onSelect("amountOut", selectTokenIn)}
        className="border rounded-b-xl mb-5 md:max-w-[472px]"
        required="This field is required"
        errors={errors}
        errorSelect={errorSelectTokenOut}
        disabled={true}
      />
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
  )
}
