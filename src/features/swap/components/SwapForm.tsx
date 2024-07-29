"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { FieldValues, useForm } from "react-hook-form"
import { parseUnits } from "viem"

import {
  CallRequestIntentProps,
  DataEstimateRequest,
  EstimateSwap,
  NetworkTokenWithSwapRoute,
  SelectToken,
} from "../../../types"
import { useCalculateTokenToUsd } from "../../../hooks/useCalculateTokenToUsd"
import { useTokensStore } from "../../../providers/TokensStoreProvider"
import { useEvaluateSwapEstimation } from "../../../hooks"
import { useModalStore } from "../../../providers/ModalStoreProvider"
import useSwapEstimateBot from "../../../hooks/useSwapEstimateBot"
import { ModalType } from "../../../stores/modalStore"
import { debounce } from "../../../utils"
import { useSwapGuard } from "../../../hooks/useSwapGuard"
import { CONFIRM_SWAP_LOCAL_KEY } from "../../../constants"
import { NetworkTokenBase } from "../../../types/base"
import { ModalSelectAssetsPayload } from "../../../components/Modal/ModalSelectAssets"
import FieldComboInput from "../../../components/Form/FieldComboInput"
import Form from "../../../components/Form"
import ButtonSwitch from "../../../components/Button/ButtonSwitch"
import BlockEvaluatePrice from "../../../components/Block/BlockEvaluatePrice"
import Button from "../../../components/Button/Button"

const ESTIMATE_BOT_AWAIT_MS = 500

type FormValues = {
  tokenIn: string
  tokenOut: string
}

interface SwapFormProps {
  onSubmit: (values: FieldValues) => void
}

const SwapForm: React.FC<SwapFormProps> = ({ onSubmit }) => {
  const [selectTokenIn, setSelectTokenIn] = useState<SelectToken>()
  const [selectTokenOut, setSelectTokenOut] = useState<SelectToken>()
  const [errorSelectTokenIn, setErrorSelectTokenIn] = useState("")
  const [errorSelectTokenOut, setErrorSelectTokenOut] = useState("")
  const {
    priceToUsd: priceToUsdTokenIn,
    calculateTokenToUsd: calculateTokenToUsdTokenIn,
  } = useCalculateTokenToUsd()
  const {
    priceToUsd: priceToUsdTokenOut,
    calculateTokenToUsd: calculateTokenToUsdTokenOut,
  } = useCalculateTokenToUsd()
  const { data, isFetched, isLoading } = useTokensStore((state) => state)
  const { data: evaluateSwapEstimation, getEvaluateSwapEstimate } =
    useEvaluateSwapEstimation()
  const {
    handleSubmit,
    register,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormValues>()
  const { setModalType, payload, onCloseModal } = useModalStore(
    (state) => state
  )
  const { getSwapEstimateBot, isFetching } = useSwapEstimateBot()
  const { handleValidateInputs, errorMsg } = useSwapGuard()
  const isProgrammaticUpdate = useRef(false)

  const handleResetToken = (
    token: SelectToken,
    checkToken: SelectToken,
    setSelectToken: (value?: SelectToken) => void
  ): boolean => {
    if (
      token!.address === checkToken?.address &&
      token!.chainId === checkToken?.chainId
    ) {
      setSelectToken(undefined)
      return true
    }
    return false
  }

  const handleValidateSelectTokens = (): boolean => {
    let isValid = true
    if (!selectTokenIn) {
      isValid = false
      setErrorSelectTokenIn("Select token is required")
    }
    if (!selectTokenOut) {
      isValid = false
      setErrorSelectTokenOut("Select token is required")
    }
    return isValid
  }

  const handleSwitch = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (isFetching) {
      return
    }
    const tempTokenInCopy = Object.assign({}, selectTokenIn)
    setSelectTokenIn(selectTokenOut)
    setSelectTokenOut(tempTokenInCopy)

    // Use isProgrammaticUpdate as true to prevent unnecessary estimate
    const valueTokenIn = getValues("tokenIn")
    const valueTokenOut = getValues("tokenOut")
    isProgrammaticUpdate.current = true
    setValue("tokenIn", valueTokenOut)
    isProgrammaticUpdate.current = true
    setValue("tokenOut", valueTokenIn)
  }

  const handleSelect = (fieldName: string, selectToken: SelectToken) => {
    setModalType(ModalType.MODAL_SELECT_ASSETS, { fieldName, selectToken })
  }

  const debouncedGetSwapEstimateBot = useCallback(
    debounce(async (data: DataEstimateRequest) => {
      const { bestOut, allEstimates } = await getSwapEstimateBot(data)
      await getEvaluateSwapEstimate("tokenOut", data, allEstimates, bestOut)
      isProgrammaticUpdate.current = true
      setValue("tokenOut", bestOut ?? "0")
    }, ESTIMATE_BOT_AWAIT_MS),
    []
  )

  const debouncedGetSwapEstimateBotReverse = useCallback(
    debounce(async (data: DataEstimateRequest) => {
      const { bestOut, allEstimates } = await getSwapEstimateBot(data)
      await getEvaluateSwapEstimate("tokenIn", data, allEstimates, bestOut)
      isProgrammaticUpdate.current = true
      setValue("tokenIn", bestOut ?? "0")

      handleValidateInputs({
        tokenIn: bestOut ?? "0",
        selectTokenIn: selectTokenIn as NetworkTokenWithSwapRoute,
        selectTokenOut: selectTokenOut as NetworkTokenWithSwapRoute,
      })
    }, ESTIMATE_BOT_AWAIT_MS),
    []
  )

  const handleEstimateSwap = ({
    tokenIn,
    tokenOut,
    name,
    selectTokenIn,
    selectTokenOut,
  }: EstimateSwap) => {
    if (
      (name === "tokenIn" && !parseFloat(tokenIn)) ||
      (name === "tokenOut" && !parseFloat(tokenOut)) ||
      !selectTokenIn ||
      !selectTokenOut
    ) {
      return
    }

    // Do not use any estimation of swap between Native and Token if ratio is 1:1
    const pair = [selectTokenIn.address, selectTokenOut.address]
    if (pair.includes("native") && pair.includes("wrap.near")) {
      isProgrammaticUpdate.current = true
      return setValue(
        name === "tokenIn" ? "tokenOut" : "tokenIn",
        name === "tokenIn" ? tokenIn : tokenOut
      )
    }

    const unitsTokenIn = parseUnits(
      tokenIn,
      selectTokenIn?.decimals ?? 0
    ).toString()
    const unitsTokenOut = parseUnits(
      tokenOut,
      selectTokenOut?.decimals ?? 0
    ).toString()

    const wTokenIn =
      selectTokenIn!.address === "native" ? "wrap.near" : selectTokenIn!.address
    if (name === "tokenIn") {
      debouncedGetSwapEstimateBot({
        tokenIn: wTokenIn,
        tokenOut: selectTokenOut?.address,
        amountIn: unitsTokenIn,
      } as DataEstimateRequest)
    } else if (name === "tokenOut") {
      debouncedGetSwapEstimateBotReverse({
        tokenIn: selectTokenOut!.address,
        tokenOut: wTokenIn,
        amountIn: unitsTokenOut,
      } as DataEstimateRequest)
    }

    handleValidateInputs({
      tokenIn,
      selectTokenIn,
      selectTokenOut,
    })
  }

  useEffect(() => {
    if (!selectTokenIn && !selectTokenOut) {
      const getConfirmSwapFromLocal = localStorage.getItem(
        CONFIRM_SWAP_LOCAL_KEY
      )
      if (getConfirmSwapFromLocal) {
        const parsedData: { data: CallRequestIntentProps } = JSON.parse(
          getConfirmSwapFromLocal
        )
        const cleanBalance = {
          balance: 0,
          balanceToUsd: 0,
          convertedLast: 0,
        }
        setSelectTokenIn(
          Object.assign(parsedData.data.selectedTokenIn, cleanBalance)
        )
        setSelectTokenOut(
          Object.assign(parsedData.data.selectedTokenOut, cleanBalance)
        )
        return
      }
      if (data.size) {
        data.forEach((token) => {
          if (token.address === "near") {
            setSelectTokenIn(token)
          }
          if (token.address === "usdt") {
            setSelectTokenOut(token)
          }
        })
        return
      }
    }
    // Do evaluate usd select tokens prices
    if (data.size && !isLoading) {
      data.forEach((token) => {
        if (selectTokenIn?.defuseAssetId === token.defuseAssetId) {
          setSelectTokenIn(token)
        }
        if (selectTokenOut?.defuseAssetId === token.defuseAssetId) {
          setSelectTokenOut(token)
        }
      })
    }
  }, [data, isFetched, isLoading])

  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (isProgrammaticUpdate.current) {
        isProgrammaticUpdate.current = false
        return
      }
      calculateTokenToUsdTokenIn(value.tokenIn as string, selectTokenIn)
      calculateTokenToUsdTokenOut(value.tokenOut as string, selectTokenOut)
      handleEstimateSwap({
        tokenIn: String(value.tokenIn),
        tokenOut: String(value.tokenOut),
        name: name as string,
        selectTokenIn,
        selectTokenOut,
      })
    })
    return () => subscription.unsubscribe()
  }, [watch, selectTokenIn, selectTokenOut, getSwapEstimateBot, setValue])

  useEffect(() => {
    // Use to calculate when selectTokenIn or selectTokenOut is changed
    const valueTokenIn = getValues("tokenIn")
    const valueTokenOut = getValues("tokenOut")
    calculateTokenToUsdTokenIn(valueTokenIn, selectTokenIn)
    calculateTokenToUsdTokenOut(valueTokenOut, selectTokenOut)

    // Use watch to calculate when input is changed
    const subscription = watch((value) => {
      calculateTokenToUsdTokenIn(value.tokenIn as string, selectTokenIn)
      calculateTokenToUsdTokenOut(value.tokenOut as string, selectTokenOut)
    })
    return () => subscription.unsubscribe()
  }, [watch, selectTokenIn, selectTokenOut])

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
          setSelectTokenIn(token)
          const isSelectTokenOutReset = handleResetToken(
            token,
            selectTokenOut as NetworkTokenBase,
            setSelectTokenOut
          )
          isSelectTokenOutReset && setValue("tokenOut", "")
          !isSelectTokenOutReset &&
            handleEstimateSwap({
              tokenIn: getValues("tokenIn"),
              tokenOut: "",
              name: "tokenIn",
              selectTokenIn: token,
              selectTokenOut,
            })
          isProgrammaticUpdate.current = false
          setErrorSelectTokenIn("")
          break
        case "tokenOut":
          setSelectTokenOut(token)
          const isSelectTokenInReset = handleResetToken(
            token,
            selectTokenIn as NetworkTokenBase,
            setSelectTokenIn
          )
          isSelectTokenInReset && setValue("tokenIn", "")
          !isSelectTokenInReset &&
            handleEstimateSwap({
              tokenIn: getValues("tokenIn"),
              tokenOut: "",
              name: "tokenIn",
              selectTokenIn,
              selectTokenOut: token,
            })
          isProgrammaticUpdate.current = false
          setErrorSelectTokenOut("")
          break
      }
      onCloseModal(undefined)
    }
  }, [payload, selectTokenIn, selectTokenOut])

  return (
    <Form<FormValues> handleSubmit={handleSubmit(onSubmit)} register={register}>
      <FieldComboInput<FormValues>
        fieldName="tokenIn"
        price={priceToUsdTokenIn}
        balance={selectTokenIn?.balance?.toString()}
        selected={selectTokenIn as NetworkTokenBase}
        handleSelect={() => handleSelect("tokenIn", selectTokenOut)}
        className="border rounded-t-xl md:max-w-[472px]"
        required="This field is required"
        errors={errors}
        errorSelect={errorSelectTokenIn}
      />
      <div className="relative w-full">
        <ButtonSwitch onClick={handleSwitch} />
      </div>
      <FieldComboInput<FormValues>
        fieldName="tokenOut"
        price={priceToUsdTokenOut}
        label={
          <BlockEvaluatePrice
            priceEvaluation={evaluateSwapEstimation?.priceEvaluation}
            priceResults={evaluateSwapEstimation?.priceResults}
          />
        }
        balance={selectTokenOut?.balance?.toString()}
        selected={selectTokenOut as NetworkTokenBase}
        handleSelect={() => handleSelect("tokenOut", selectTokenIn)}
        className="border rounded-b-xl mb-5 md:max-w-[472px]"
        required="This field is required"
        errors={errors}
        errorSelect={errorSelectTokenOut}
      />
      <Button
        type="submit"
        size="lg"
        fullWidth
        isLoading={isFetching}
        disabled={Boolean(errorMsg)}
      >
        {isFetching ? "" : errorMsg ? errorMsg : "Swap"}
      </Button>
    </Form>
  )
}

export default SwapForm
