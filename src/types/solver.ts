import { DataEstimateRequest } from "./quoting"

export interface SolverQuoteData {
  solverId: string
  amountOut: string
}

export interface SolverEstimateProviderResponse extends SolverQuoteData {
  list?: SolverQuoteData[]
}

export type SolverEstimateProvider = (
  data: DataEstimateRequest
) => Promise<SolverEstimateProviderResponse>

export interface SolverSettings {
  providerIds: SolverEstimateProvider[]
}
