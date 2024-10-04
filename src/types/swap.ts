import type { BaseTokenInfo } from "./base"

// TODO: Must be moved to @defuse/swap-facade
export type SwapMessageParams = {
  message: string
  recipient: string
  nonce: Buffer
  callbackUrl?: string
  state?: string
}

export type SwapEvent = {
  type: string
  data: unknown
  error?: string
}

export type SwapWidgetProps = {
  theme?: "dark" | "light"
  tokenList: BaseTokenInfo[]
  onEmit?: (event: SwapEvent) => void
  onSign: (params: SwapMessageParams) => Promise<{ signature: string }>
}

export enum QueueTransactionsEnum {
  DEPOSIT = "deposit",
  WITHDRAW = "withdraw",
  STORAGE_DEPOSIT_TOKEN_IN = "storageDepositTokenIn",
  STORAGE_DEPOSIT_TOKEN_OUT = "storageDepositTokenOut",
  CREATE_INTENT = "createIntent",
}

export type SelectToken = BaseTokenInfo | undefined

export type EstimateSwap = {
  tokenIn: string
  tokenOut: string
  name: string
  selectTokenIn: SelectToken
  selectTokenOut: SelectToken
}

export interface NetworkTokenWithSwapRoute extends BaseTokenInfo {
  routes: string[]
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
  selectedTokenIn: BaseTokenInfo
  selectedTokenOut: BaseTokenInfo
  estimateQueue: EstimateQueueTransactions
  intentId?: string
  solverId?: string
}

export enum EvaluateResultEnum {
  BEST = 0,
  LOW = 1,
}

type WithAccounts = {
  accountFrom?: string
  accountTo?: string
}

export interface ModalConfirmSwapPayload
  extends CallRequestIntentProps,
    WithAccounts {}

export enum INDEXER {
  INTENT_0 = 0,
  INTENT_1 = 1,
}
