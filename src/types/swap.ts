import { NetworkTokenBase } from "./base"

export enum QueueTransactionsEnum {
  "DEPOSIT" = "deposit",
  "WITHDRAW" = "withdraw",
  "STORAGE_DEPOSIT_TOKEN_IN" = "storageDepositTokenIn",
  "STORAGE_DEPOSIT_TOKEN_OUT" = "storageDepositTokenOut",
  "CREATE_INTENT" = "createIntent",
}

export type SelectToken = NetworkTokenBase | undefined

export type EstimateSwap = {
  tokenIn: string
  tokenOut: string
  name: string
  selectTokenIn: SelectToken
  selectTokenOut: SelectToken
}

export interface NetworkTokenWithSwapRoute extends NetworkTokenBase {
  routes?: string[]
}

export type EstimateQueueTransactions = {
  queueTransactionsTrack: QueueTransactionsEnum[]
  queueInTrack: number
}

export type NextEstimateQueueTransactionsProps = {
  estimateQueue: EstimateQueueTransactions
  receivedHash: string
}

export type NextEstimateQueueTransactionsResult = {
  value: EstimateQueueTransactions
  done: boolean
}

export type CallRequestIntentProps = {
  tokenIn: string
  tokenOut: string
  selectedTokenIn: NetworkTokenBase
  selectedTokenOut: NetworkTokenBase
  estimateQueue: EstimateQueueTransactions
  clientId?: string
}

type WithSwapDepositRequest = {
  useNative?: boolean
}
