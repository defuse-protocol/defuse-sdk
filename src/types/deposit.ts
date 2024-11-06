import type { SwappableToken } from "../types"

export enum SignInType {
  NearWalletSelector = "near-wallet-selector",
  Wagmi = "wagmi",
}

export type DepositWidgetProps = {
  tokenList: SwappableToken[]
  userAddress: string | null
  userNetwork: string | undefined
  sendTransactionNear: (transactions: Transaction[]) => Promise<string>
  onEmit?: (event: DepositEvent) => void
}

export type DepositEvent = {
  type: string
  data: unknown
  error?: string
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
