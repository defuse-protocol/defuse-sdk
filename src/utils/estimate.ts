import {
  DataEstimateRequest,
  EstimateProvider,
  Settings,
  SwapEstimateProviderResponse,
} from "../types"

import { getSettings, setSettings } from "./settings"
import { swapEstimateSolver0Provider } from "./solver"

const IS_DISABLE_QUOTING_FROM_SOLVER_0 =
  process?.env?.NEXT_PUBLIC_DISABLE_QUOTING_FROM_SOLVER_0 === "true"

// All other Solver Providers have to be included there
// Example:
//          swapEstimateSolver1Provider,
//          swapEstimateSolver2Provider,
//          ...,
export const estimateProviders: Settings = {
  providerIds: [],
}

if (!IS_DISABLE_QUOTING_FROM_SOLVER_0) {
  Object.assign(estimateProviders, {
    providerIds: [
      ...estimateProviders.providerIds,
      swapEstimateSolver0Provider,
    ],
  })
}

setSettings(estimateProviders)

export const concurrentEstimateSwap = async (
  data: DataEstimateRequest
): Promise<SwapEstimateProviderResponse[]> => {
  const { providerIds } = getSettings()

  return Promise.all(
    providerIds.map(async (provider: EstimateProvider) => await provider(data))
  )
}
