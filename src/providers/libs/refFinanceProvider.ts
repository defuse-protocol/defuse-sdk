import {
  estimateSwap,
  fetchAllPools,
  EstimateSwapView,
  Pool,
  StablePool,
  ftGetTokenMetadata,
  getStablePools,
  SwapOptions,
  init_env,
} from "@ref-finance/ref-sdk"
import { formatUnits } from "viem"

import {
  DataEstimateRequest,
  SolverEstimateProviderResponse,
} from "../../types"

const environment =
  process?.env?.environment === "production" ? "mainnet" : "testnet"
init_env(environment)

export const REGISTRAR_ID_REF_FINANCE = "ref.finance"

export const swapEstimateRefFinanceProvider = async (
  data: DataEstimateRequest
): Promise<SolverEstimateProviderResponse> => {
  try {
    const { ratedPools, unRatedPools, simplePools } = await fetchAllPools()

    const stablePools: Pool[] = unRatedPools.concat(ratedPools)
    const stablePoolsDetail: StablePool[] = await getStablePools(stablePools)

    const options: SwapOptions = {
      enableSmartRouting: false,
      stablePools,
      stablePoolsDetail,
    }

    const tokenInWithMeta = await ftGetTokenMetadata(data.tokenIn)
    const tokenOutWithMeta = await ftGetTokenMetadata(data.tokenOut)

    const formattedAmountOut = formatUnits(
      BigInt(data.amountIn),
      tokenInWithMeta.decimals
    )

    const swapTodos: EstimateSwapView[] = await estimateSwap({
      tokenIn: tokenInWithMeta,
      tokenOut: tokenOutWithMeta,
      amountIn: formattedAmountOut,
      simplePools,
      options,
    })

    if (!swapTodos.length) {
      return {
        solverId: `${REGISTRAR_ID_REF_FINANCE}:`,
        amountOut: "0",
      } as SolverEstimateProviderResponse
    }

    const getSortedList = swapTodos.sort(
      (a, b) => Number(b?.estimate) - Number(a?.estimate)
    )
    console.log("swapEstimateRefFinanceProvider:", getSortedList)
    return {
      solverId: `${REGISTRAR_ID_REF_FINANCE}:${getSortedList[0]?.pool?.id}`,
      amountOut: (getSortedList[0]?.estimate as string) ?? "0",
    } as SolverEstimateProviderResponse
  } catch (e) {
    console.log("swapEstimateRefFinanceProvider: ", e)
    return {
      solverId: `${REGISTRAR_ID_REF_FINANCE}:0`,
      amountOut: "0",
    }
  }
}
