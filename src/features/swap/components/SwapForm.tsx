import { quoteMachine } from "@defuse-protocol/swap-facade"
import { useActor, useSelector } from "@xstate/react"
import { useEffect, useRef, useState } from "react"
import { useFormContext } from "react-hook-form"

import { ButtonCustom, ButtonSwitch } from "../../../components/Button"
import { Form } from "../../../components/Form"
import { FieldComboInput } from "../../../components/Form/FieldComboInput"
import { WarnBox } from "../../../components/WarnBox"
import { NEAR_TOKEN_META } from "../../../constants"
import type { BaseTokenInfo } from "../../../types/base"

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
  selectTokenIn?: BaseTokenInfo
  selectTokenOut?: BaseTokenInfo
  onSubmit: (values: OnSubmitValues) => void
  onSelect: (fieldName: string, selectToken: BaseTokenInfo) => void
  onSwitch: (e: React.MouseEvent<HTMLButtonElement>) => void
  isFetching: boolean
}

export const SwapForm = ({
  selectTokenIn,
  selectTokenOut,
  onSubmit,
  onSelect,
  onSwitch,
  isFetching,
}: SwapFormProps) => {
  const {
    handleSubmit,
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<SwapFormValues>()

  const allowableNearAmountRef = useRef<null | string>(null)

  const [errorSelectTokenIn, setErrorSelectTokenIn] = useState("")
  const [errorSelectTokenOut, setErrorSelectTokenOut] = useState("")
  const [errorMsg, setErrorMsg] = useState<ErrorEnum>()

  const [state, send, actorRef] = useActor(quoteMachine, {
    input: {
      assetIn: selectTokenIn?.defuseAssetId,
      assetOut: selectTokenOut?.defuseAssetId,
    },
  })
  console.log("LOG: quoteMachine - state", state)

  const handleSwitch = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    onSwitch(e)
    setValue("amountOut", "")
    setValue("amountIn", "")
  }

  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name === "amountIn" && selectTokenIn && selectTokenOut) {
        send({
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
  }, [watch, selectTokenIn, selectTokenOut, send])

  const quotes = useSelector(actorRef, (state) => state.context.quotes)

  useEffect(() => {
    if (quotes) {
      // TODO: amountOut - Find the best quote with the highest estimatedOut value
      if (quotes.length > 0 && quotes[0]) {
        setValue(
          "amountOut",
          (quotes[0] as unknown as { amountOut: string }).amountOut
        )
      }
    }
  }, [quotes, setValue])

  return (
    <div className="md:max-w-[472px] rounded-[1rem] p-5 shadow-paper bg-white dark:shadow-paper-dark dark:bg-black-800">
      <Form<SwapFormValues>
        handleSubmit={handleSubmit((values: SwapFormValues) =>
          onSubmit(values as OnSubmitValues)
        )}
        register={register}
      >
        <FieldComboInput<SwapFormValues>
          fieldName="amountIn"
          selected={selectTokenIn as BaseTokenInfo}
          handleSelect={() =>
            onSelect("tokenIn", selectTokenOut as BaseTokenInfo)
          }
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
          selected={selectTokenOut as BaseTokenInfo}
          handleSelect={() =>
            onSelect("tokenOut", selectTokenIn as BaseTokenInfo)
          }
          className="border rounded-b-xl mb-5"
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
    </div>
  )
}
