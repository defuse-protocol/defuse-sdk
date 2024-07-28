import { useState } from "react"

import { DataEstimateRequest, SwapEstimateBotResult } from "../types/quoting"
import { swapEstimateRefFinanceProvider } from "../features/quoting/utils/refFinanceProvider"
import { useTokensStore } from "../providers/TokensStoreProvider"
import { NetworkTokenWithSwapRoute } from "../types"

const IS_DISABLE_QUOTING_FROM_REF =
  process.env.NEXT_PUBLIC_DISABLE_QUOTING_FROM_REF === "true"
const IS_DISABLE_QUOTING_FROM_COINGECKO =
  process.env.NEXT_PUBLIC_DISABLE_QUOTING_FROM_COINGECKO === "true"

export enum EvaluateResultEnum {
  BEST = "best price",
  LOW = "low price",
}

export interface EvaluateSwapEstimationResult {
  priceEvaluation: EvaluateResultEnum | undefined
  priceResults?: {
    solverId: string
    amountOut: string
  }[]
}

const ESTIMATE_DIFFERENCE_PERCENTAGE = 2

export const useEvaluateSwapEstimation = () => {
  const [data, setData] = useState<EvaluateSwapEstimationResult | undefined>()
  const [isFetched, setIsFetched] = useState(false)
  const { data: tokensData } = useTokensStore((state) => state)

  const findTokenByName = (
    tokenAddress: string
  ): NetworkTokenWithSwapRoute | undefined => {
    let token = undefined
    if (tokensData.size) {
      tokensData.forEach((networkToken) => {
        if (networkToken.address === tokenAddress) {
          token = networkToken
        }
      })
    }
    return token
  }

  const getSwapEstimateFromRefFinance = async (
    fieldName: string,
    dataEstimate: DataEstimateRequest,
    bestOut: SwapEstimateBotResult["bestOut"]
  ): Promise<void> => {
    if (!IS_DISABLE_QUOTING_FROM_REF) {
      const result = await swapEstimateRefFinanceProvider(dataEstimate)
      if (parseFloat(result.amountOut) && bestOut) {
        if (bestOut > result.amountOut) {
          setData((state) => ({
            priceEvaluation: EvaluateResultEnum.BEST,
            priceResults: state?.priceResults,
          }))
          return
        }
        const resultAmountOut = parseFloat(result.amountOut)
        const difference = Math.abs(Number(bestOut) - resultAmountOut)
        const average = (Number(bestOut) + resultAmountOut) / 2
        const percentageDifference = (difference / average) * 100

        if (percentageDifference > ESTIMATE_DIFFERENCE_PERCENTAGE) {
          setData((state) => ({
            priceEvaluation: EvaluateResultEnum.LOW,
            priceResults: state?.priceResults,
          }))
          return
        }
      }
      return
    }

    setData((state) => ({
      priceEvaluation: EvaluateResultEnum.BEST,
      priceResults: state?.priceResults,
    }))
  }

  const getSolversResults = (
    estimatesFromSolvers: SwapEstimateBotResult["allEstimates"]
  ) => {
    setData((state) => ({
      priceEvaluation: state?.priceEvaluation,
      priceResults: estimatesFromSolvers,
    }))
  }

  const cleanEvaluateSwapEstimate = () => {
    setData({
      priceEvaluation: undefined,
      priceResults: undefined,
    })
  }

  const getEvaluateSwapEstimate = async (
    fieldName: string,
    data: DataEstimateRequest,
    estimatesFromSolvers: SwapEstimateBotResult["allEstimates"],
    bestOut: SwapEstimateBotResult["bestOut"]
  ): Promise<void> => {
    cleanEvaluateSwapEstimate()
    getSolversResults(estimatesFromSolvers)

    setIsFetched(true)
    await getSwapEstimateFromRefFinance(fieldName, data, bestOut)
    setIsFetched(false)
  }

  return {
    data,
    cleanEvaluateSwapEstimate,
    getEvaluateSwapEstimate,
    isFetched,
  }
}
