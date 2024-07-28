import { TokenExchangeBase } from "./base"
import { SolverEstimateProviderResponse } from "./solver"

export interface DataEstimateRequest extends TokenExchangeBase {
  amountIn: string
}

export interface SwapEstimateBotResult {
  bestOut: string | null
  allEstimates?: SolverEstimateProviderResponse[]
}
