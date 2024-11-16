import type { RpcUrl } from "src/utils/defuse"

export interface SwapEstimateBotResult {
  bestOut: string | null
  allEstimates?: SwapEstimateProviderResponse[]
}

export interface DataEstimateRequest {
  tokenIn: string
  tokenOut: string
  amountIn: string
}

export interface SolverQuoteData {
  solver_id: string
  amount_out: string
}

export type SwapEstimateProviderResponse = SolverQuoteData[]

export type EstimateProvider = (
  data: DataEstimateRequest
) => Promise<SwapEstimateProviderResponse>

export interface Settings {
  providerIds: EstimateProvider[]
  defuseContractId: string
  swapExpirySec: number
  quoteQueryTimeoutMs: number
  quotePollingIntervalMs: number
  quoteMinDeadlineMs: number
  queries: {
    staleTime: number
  }
  rpcUrls: {
    near: RpcUrl
    ethereum: RpcUrl
    base: RpcUrl
    arbitrum: RpcUrl
    bitcoin: RpcUrl
    solana: RpcUrl
  }
}
