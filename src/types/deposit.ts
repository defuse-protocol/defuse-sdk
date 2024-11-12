import type { SwappableToken } from "../types"

export type ChainType = "near" | "evm"

export const ChainType = {
  Near: "near",
  EVM: "evm",
} as const

export type UserInfo =
  | {
      userAddress: string
      chainType: ChainType
    }
  | {
      userAddress: undefined
      chainType: undefined
    }

export type DepositWidgetProps = UserInfo & {
  tokenList: SwappableToken[]
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

export type DepositSnapshot = {
  txHash: string
}
