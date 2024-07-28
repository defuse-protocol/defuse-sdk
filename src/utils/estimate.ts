import { getSettings, setSettings } from "../config/settings"
import {
  DataEstimateRequest,
  SolverEstimateProviderResponse,
  SolverSettings,
} from "../types"
import { swapEstimateSolver0Provider } from "../providers/libs"

const IS_DISABLE_QUOTING_FROM_SOLVER_0 =
  process?.env?.NEXT_PUBLIC_DISABLE_QUOTING_FROM_SOLVER_0 === "true"

// All other Solver Providers have to be included there
// Example:
//          swapEstimateSolver1Provider,
//          swapEstimateSolver2Provider,
//          ...,
export const estimateProviders: SolverSettings = {
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
): Promise<SolverEstimateProviderResponse[]> => {
  const { providerIds } = getSettings()

  return Promise.all(providerIds.map(async (provider) => await provider(data)))
}
