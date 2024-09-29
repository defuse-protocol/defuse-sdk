import { formatUnits } from "ethers"

import { NEAR_TOKEN_META, W_NEAR_TOKEN_META } from "../constants"
import { swapEstimateRefFinanceProvider } from "../features/quoting/utils/refFinanceProvider"
import { BaseTokenInfo } from "../types/base"

import parseDefuseAsset from "./parseDefuseAsset"

export enum EvaluateResultEnum {
  BEST,
  LOW,
}

const ESTIMATE_DIFFERENCE_PERCENTAGE = 2
function prepareRefAddressData(address: string) {
  if (address === NEAR_TOKEN_META.address) return W_NEAR_TOKEN_META.address
  return address
}
const getSwapEstimateFromRefFinance = async (
  tokenIn: BaseTokenInfo,
  tokenOut: BaseTokenInfo,
  amountIn: string,
  bestOut: string
): Promise<EvaluateResultEnum | null> => {
  try {
    const result = await swapEstimateRefFinanceProvider({
      tokenIn: prepareRefAddressData(tokenIn.address!),
      tokenOut: prepareRefAddressData(tokenOut.address!),
      amountIn,
    })

    if (result === "0") return null
    const refFinancePrice = +result
    const bestOutN = +formatUnits(BigInt(bestOut), tokenOut.decimals!)
    if (bestOutN > refFinancePrice) {
      return EvaluateResultEnum.BEST
    }

    const difference = Math.abs(Number(bestOutN) - refFinancePrice)
    const average = (bestOutN + refFinancePrice) / 2
    const percentageDifference = (difference / average) * 100

    if (percentageDifference > ESTIMATE_DIFFERENCE_PERCENTAGE) {
      return EvaluateResultEnum.LOW
    }

    return null
  } catch (e) {
    console.error("Failed to get evaluation from Ref Finance", e)
    return null
  }
}

export const getEvaluateSwapEstimate = async (
  tokenIn: BaseTokenInfo,
  tokenOut: BaseTokenInfo,
  amountIn: string,
  bestOut: string
): Promise<{
  refFinance: EvaluateResultEnum | null
}> => {
  const from = parseDefuseAsset(tokenIn.defuseAssetId)
  const to = parseDefuseAsset(tokenOut.defuseAssetId)
  return {
    refFinance:
      from?.blockchain === "near" && to?.blockchain === "near"
        ? await getSwapEstimateFromRefFinance(
            tokenIn,
            tokenOut,
            amountIn,
            bestOut
          )
        : null,
  }
}
