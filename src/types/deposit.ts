import type { SwappableToken } from "../types"

export type DepositWidgetProps = {
  tokenList: SwappableToken[]
  userAddress: string | null
  sendTransactionNear: (transactions: Transaction[]) => Promise<string>
  onEmit?: (event: DepositEvent) => void
}

export type DepositEvent = {
  type: string
  data: unknown
  error?: string
}

export enum DepositBlockchainEnum {
  NEAR = "near:mainnet",
  ETHEREUM = "eth:1",
  BASE = "eth:8453",
  ARBITRUM = "eth:42161",
  BITCOIN = "btc:mainnet",
}

export interface FunctionCallAction {
  type: "FunctionCall"
  params: {
    methodName: string
    args: object
    gas: string
    deposit: string
  }
}

export type Action = FunctionCallAction

export interface Transaction {
  receiverId: string
  actions: Array<Action>
}

export interface BaseAssetInfo {
  address: string
  decimals: number
  icon: string
  symbol: string
}
