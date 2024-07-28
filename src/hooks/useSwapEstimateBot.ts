import { useState } from "react"

import { setSettings } from "../config/settings"
import { DataEstimateRequest, SolverEstimateProviderResponse } from "../types"
import { concurrentEstimateSwap } from "../utils"

export interface SwapEstimateBotResult {
  bestOut: string | null
  allEstimates?: SolverEstimateProviderResponse[]
}

const useSwapEstimateBot = () => {
  const [isFetching, setFetching] = useState(false)

  const getSwapEstimateBot = async (
    data: DataEstimateRequest
  ): Promise<SwapEstimateBotResult> => {
    setFetching(true)
    // console.log("getSwapEstimateBot data:", data)
    const estimates = await concurrentEstimateSwap(data)

    if (!estimates.length) {
      setFetching(false)
      return {
        bestOut: null,
      }
    }

    const sortEstimates = estimates.sort(
      (a, b) => Number(b.amountOut) - Number(a.amountOut)
    )
    console.log("useSwapEstimateBot: ", estimates)
    setFetching(false)
    return {
      bestOut: sortEstimates[0]!.amountOut,
      allEstimates: sortEstimates[0]?.list,
    }
  }

  return {
    isFetching,
    getSwapEstimateBot,
  }
}

export default useSwapEstimateBot
