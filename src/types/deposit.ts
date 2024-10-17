export enum BlockchainEnum {
  NEAR = "near",
  ETHEREUM = "ethereum",
  BASE = "base",
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

export enum TransactionMethod {
  FT_TRANSFER_CALL = "ft_transfer_call",
}

export interface BaseAssetInfo {
  address: string
  decimals: number
  icon: string
  symbol: string
}
