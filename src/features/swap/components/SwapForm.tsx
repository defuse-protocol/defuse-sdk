import React, { useCallback, useEffect, useRef, useState } from "react"
import { FieldValues, useForm } from "react-hook-form"
import { parseUnits } from "ethers"

import { ButtonCustom } from "src/components/Button/ButtonCustom"

import { useCalculateTokenToUsd } from "../../../hooks/useCalculateTokenToUsd"
import { BaseTokenInfo } from "../../../types/base"
import { useTokensStore } from "../../../providers/TokensStoreProvider"
import { useModalStore } from "../../../providers/ModalStoreProvider"
import { useSwapEstimateBot } from "../../../hooks/useSwapEstimateBot"
import { EvaluateResultEnum, ModalConfirmSwapPayload } from "../../../types"
import { useModalSearchParams } from "../../../hooks/useModalSearchParams"
import { isWalletConnected } from "../../../utils/isWalletConnected"
import { isForeignChainSwap } from "../../../utils/isForeignChainSwap"
import { ModalType } from "../../../stores/modalStore"
import { debouncePromise } from "../../../utils/debouncePromise"
import {
  balanceToBignumberString,
  balanceToDecimal,
} from "../../../utils/balanceTo"
import { getEvaluateSwapEstimate } from "../../../utils/evaluateSwap"
import { CONFIRM_SWAP_LOCAL_KEY, NEAR_TOKEN_META } from "../../../constants"
import {
  ModalSelectAssetsPayload,
  TokenListWithNotSelectableToken,
} from "../../../components/Modal/ModalSelectAssets"
import { tieNativeToWrapToken } from "../../../utils/tokenList"
import { isSameToken } from "../../../utils/isSameToken"
import { Form } from "../../../components/Form"
import { FieldComboInput } from "../../../components/Form/FieldComboInput"
import { ButtonSwitch } from "../../../components/Button/ButtonSwitch"
import { BlockEvaluatePrice } from "../../../components/Block/BlockEvaluatePrice"
import { WarnBox } from "../../../components/WarnBox"

type FormValues = {
  tokenIn: string
  tokenOut: string
}

type SelectToken = BaseTokenInfo | undefined

type EstimateSwap = {
  tokenIn: string
  name: string
  selectTokenIn: SelectToken
  selectTokenOut: SelectToken
}

enum ErrorEnum {
  INSUFFICIENT_BALANCE = "Insufficient Balance",
  NO_QUOTES = "No Quotes",
  EXCEEDED_NEAR_PER_BYTE_USE = "Not enough Near in wallet for gas fee",
}

const ESTIMATE_BOT_AWAIT_MS = 500

export const SwapForm = () => {
  const [selectTokenIn, setSelectTokenIn] = useState<SelectToken>()
  const [selectTokenOut, setSelectTokenOut] = useState<SelectToken>()
  const [errorSelectTokenIn, setErrorSelectTokenIn] = useState("")
  const [errorSelectTokenOut, setErrorSelectTokenOut] = useState("")
  // const { accountId } = useWalletSelector()
  const {
    priceToUsd: priceToUsdTokenIn,
    calculateTokenToUsd: calculateTokenToUsdTokenIn,
  } = useCalculateTokenToUsd()
  const {
    priceToUsd: priceToUsdTokenOut,
    calculateTokenToUsd: calculateTokenToUsdTokenOut,
  } = useCalculateTokenToUsd()
  const { data, isLoading } = useTokensStore((state) => state)
  // const { handleSignIn } = useConnectWallet()
  const [priceEvaluation, setPriceEvaluation] =
    useState<EvaluateResultEnum | null>(null)
  const {
    handleSubmit,
    register,
    watch,
    setValue,
    getValues,
    trigger,
    clearErrors,
    formState: { errors },
  } = useForm<FormValues>({ reValidateMode: "onSubmit" })
  const { setModalType, payload, onCloseModal } = useModalStore(
    (state) => state
  )
  const { bestEstimate, allEstimates, getSwapEstimateBot } =
    useSwapEstimateBot()
  const isProgrammaticUpdate = useRef(false)
  const lastInputValue = useRef("")
  useModalSearchParams()
  const [errorMsg, setErrorMsg] = useState<ErrorEnum>()
  const [isFetchingData, setIsFetchingData] = useState(false)
  const allowableNearAmountRef = useRef<null | string>(null)
  // const { setNotification } = useNotificationStore((state) => state)

  const onSubmit = async (values: FieldValues) => {
    if (errorMsg) {
      return
    }
    // if (!accountId) {
    //   return handleSignIn()
    // }
    let hasUnsetTokens = false
    if (!selectTokenIn) {
      hasUnsetTokens = true
      setErrorSelectTokenIn("Select token is required")
    }
    if (!selectTokenOut) {
      hasUnsetTokens = true
      setErrorSelectTokenOut("Select token is required")
    }

    if (hasUnsetTokens) return

    const accountTo = isWalletConnected(selectTokenOut?.defuseAssetId as string)

    const modalType =
      isForeignChainSwap(
        selectTokenIn?.defuseAssetId as string,
        selectTokenOut?.defuseAssetId as string
      ) && !accountTo
        ? ModalType.MODAL_CONNECT_NETWORKS
        : ModalType.MODAL_REVIEW_SWAP

    const modalPayload = {
      tokenIn: balanceToBignumberString(
        values.tokenIn,
        selectTokenIn?.decimals ?? 0
      ),
      tokenOut: balanceToBignumberString(
        values.tokenOut,
        selectTokenOut?.decimals ?? 0
      ),
      selectedTokenIn: selectTokenIn,
      selectedTokenOut: selectTokenOut,
      solverId: bestEstimate?.solver_id || "",
      accountTo,
    }

    setModalType(modalType, modalPayload)
  }

  const handleSwitch = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (isFetchingData) {
      return
    }
    setErrorMsg(undefined)
    setPriceEvaluation(null)
    const tempTokenInCopy = Object.assign({}, selectTokenIn)

    // if (!selectTokenOut?.routes?.length) {
    //   setNotification({
    //     id: v4(),
    //     message: "This switch not available!",
    //     type: NotificationType.ERROR,
    //   })
    //   return
    // }

    setSelectTokenIn(selectTokenOut)
    setSelectTokenOut(tempTokenInCopy)

    const valueTokenIn = getValues("tokenIn")
    const valueTokenOut = getValues("tokenOut")
    setValue("tokenOut", valueTokenIn)
    setValue("tokenIn", valueTokenOut)
  }

  const handleSelect = (fieldName: string, selectToken: SelectToken) => {
    setModalType(ModalType.MODAL_SELECT_ASSETS, { fieldName, selectToken })
  }

  const debouncedGetSwapEstimateBot = useCallback(
    debouncePromise(
      async (data: { tokenIn: string; tokenOut: string; amountIn: string }) =>
        getSwapEstimateBot(data),
      ESTIMATE_BOT_AWAIT_MS
    ),
    []
  )

  const handleEstimateSwap = async ({
    tokenIn,
    name,
    selectTokenIn,
    selectTokenOut,
  }: EstimateSwap): Promise<void> => {
    try {
      setErrorMsg(undefined)
      setPriceEvaluation(null)
      allowableNearAmountRef.current = null
      clearErrors()
      lastInputValue.current = tokenIn

      // Check for empty input
      if (
        (name === "tokenIn" && !tokenIn) ||
        !selectTokenIn ||
        !selectTokenOut
      ) {
        isProgrammaticUpdate.current = true
        setValue("tokenOut", "")
        setIsFetchingData(false)
        return
      }

      const parsedTokenInBigNumber = BigInt(
        balanceToBignumberString(tokenIn, selectTokenIn?.decimals ?? 0)
      )
      const balanceTokenInBigNumber = BigInt(selectTokenIn?.balance ?? "0")

      // if (selectTokenIn.id === NEAR_TOKEN_META.id && accountId) {
      //   const balanceAllowed = await getBalanceNearAllowedToSwap(accountId)
      //   const balanceAllowedBigNumber = BigInt(balanceAllowed)
      //   if (parsedTokenInBigNumber > balanceAllowedBigNumber) {
      //     setErrorMsg(ErrorEnum.EXCEEDED_NEAR_PER_BYTE_USE)
      //     allowableNearAmountRef.current = balanceAllowedBigNumber.toString()
      //   }
      // }

      if (parsedTokenInBigNumber > balanceTokenInBigNumber) {
        setErrorMsg(ErrorEnum.INSUFFICIENT_BALANCE)
      }

      setIsFetchingData(true)
      const { bestEstimate } = await debouncedGetSwapEstimateBot({
        tokenIn: selectTokenIn.defuseAssetId,
        tokenOut: selectTokenOut.defuseAssetId,
        amountIn: parseUnits(tokenIn, selectTokenIn?.decimals ?? 0).toString(),
      })

      if (lastInputValue.current === tokenIn) {
        // no estimate available
        if (bestEstimate === null) {
          isProgrammaticUpdate.current = true
          setValue("tokenOut", "")
          setErrorMsg(ErrorEnum.NO_QUOTES)
          setIsFetchingData(false)
          return
        }
        getEvaluateSwapEstimate(
          selectTokenIn,
          selectTokenOut,
          tokenIn,
          bestEstimate.amount_out
        )
          .then(({ refFinance }) => {
            if (lastInputValue.current === tokenIn) {
              setPriceEvaluation(refFinance)
            }
          })
          .catch((e) => {
            console.error(e)
          })
        isProgrammaticUpdate.current = true
        const formattedOut =
          bestEstimate.amount_out !== null
            ? balanceToDecimal(
                bestEstimate.amount_out,
                selectTokenOut.decimals!
              )
            : "0"
        setValue("tokenOut", formattedOut)
        trigger("tokenOut")

        setIsFetchingData(false)
      }
    } catch (e) {
      console.error(e)
      setIsFetchingData(false)
    }
  }

  const handleHashTokenSelections = (
    selectedTokenIn: BaseTokenInfo,
    selectedTokenOut: BaseTokenInfo
  ) => {
    localStorage.setItem(
      CONFIRM_SWAP_LOCAL_KEY,
      JSON.stringify({
        data: {
          selectedTokenIn,
          selectedTokenOut,
          tokenIn: "0",
          tokenOut: "0",
          estimateQueue: [],
        },
      })
    )
  }

  useEffect(() => {
    if (!selectTokenIn && !selectTokenOut) {
      const getConfirmSwapFromLocal = localStorage.getItem(
        CONFIRM_SWAP_LOCAL_KEY
      )
      if (getConfirmSwapFromLocal) {
        const parsedData: { data: ModalConfirmSwapPayload } = JSON.parse(
          getConfirmSwapFromLocal
        )
        const cleanBalance = {
          balance: "0",
          balanceUsd: 0,
          convertedLast: undefined,
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
      const getAssetList: TokenListWithNotSelectableToken[] = []
      data.forEach((value) => getAssetList.push(value))
      const tieNativeToWrapAssetList = tieNativeToWrapToken(getAssetList)
      tieNativeToWrapAssetList.forEach((token) => {
        if (selectTokenIn?.defuseAssetId === token.defuseAssetId) {
          setSelectTokenIn(token)
        }
        if (selectTokenOut?.defuseAssetId === token.defuseAssetId) {
          setSelectTokenOut(token)
        }
      })
    }
  }, [data, isLoading])

  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (isProgrammaticUpdate.current) {
        isProgrammaticUpdate.current = false
        return
      }
      handleEstimateSwap({
        tokenIn: String(value.tokenIn),
        name: name as string,
        selectTokenIn,
        selectTokenOut,
      })
    })
    return () => subscription.unsubscribe()
  }, [watch, selectTokenIn, selectTokenOut])

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
          const isSelectTokenOutReset = isSameToken(
            token,
            selectTokenOut as BaseTokenInfo
          )

          if (isSelectTokenOutReset) {
            setSelectTokenOut(undefined)
            setValue("tokenOut", "")
          } else {
            handleEstimateSwap({
              tokenIn: getValues("tokenIn"),
              name: "tokenIn",
              selectTokenIn: token,
              selectTokenOut,
            })
            handleHashTokenSelections(token, selectTokenOut as BaseTokenInfo)
          }
          isProgrammaticUpdate.current = false
          setErrorSelectTokenIn("")
          break
        case "tokenOut":
          setSelectTokenOut(token)
          const isSelectTokenInReset = isSameToken(
            token,
            selectTokenIn as BaseTokenInfo
          )
          if (isSelectTokenInReset) {
            setSelectTokenIn(undefined)
            setValue("tokenIn", "")
          } else {
            handleEstimateSwap({
              tokenIn: getValues("tokenIn"),
              name: "tokenIn",
              selectTokenIn,
              selectTokenOut: token,
            })
            handleHashTokenSelections(selectTokenIn as BaseTokenInfo, token)
          }
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
        balance={balanceToDecimal(
          selectTokenIn?.balance ?? "0",
          selectTokenIn?.decimals ?? 0
        )}
        selected={selectTokenIn as BaseTokenInfo}
        handleSelect={() => handleSelect("tokenIn", selectTokenOut)}
        handleSetMaxValue={() => {
          const value = balanceToDecimal(
            selectTokenIn?.balance ?? "0",
            selectTokenIn?.decimals ?? 0
          )
          setValue("tokenIn", value)
        }}
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
            priceEvaluation={priceEvaluation}
            priceResults={allEstimates}
            tokenOut={selectTokenOut}
          />
        }
        balance={balanceToDecimal(
          selectTokenOut?.balance ?? "0",
          selectTokenOut?.decimals ?? 0
        )}
        selected={selectTokenOut as BaseTokenInfo}
        handleSelect={() => handleSelect("tokenOut", selectTokenIn)}
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
              setValue("tokenIn", value)
            }}
          />
        )}
      <ButtonCustom
        type="submit"
        size="lg"
        fullWidth
        isLoading={isFetchingData}
        disabled={Boolean(errorMsg)}
      >
        {isFetchingData ? "" : errorMsg ? errorMsg : "Swap"}
      </ButtonCustom>
    </Form>
  )
}
