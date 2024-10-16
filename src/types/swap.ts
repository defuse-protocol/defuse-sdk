import type { BaseTokenInfo } from "./base"

// Message for EVM wallets
export type EIP712Message = {
  type: "EIP-712"
  // biome-ignore lint/complexity/noBannedTypes: todo: populate with actual EIP-712 type
  message: {}
}

export type EIP712SignatureData = {
  type: "EIP-712"
  signatureData: string
}

// Message for NEAR wallets
export type NEP141Message = {
  type: "NEP-141"
  message: {
    message: string
    recipient: string
    nonce: Uint8Array
  }
}

export type NEP141SignatureData = {
  type: "NEP-141"
  signatureData: {
    accountId: string
    publicKey: string
    signature: string
  }
}

export type WalletMessage = EIP712Message | NEP141Message
export type WalletSignatureResult =
  | EIP712SignatureData
  | NEP141SignatureData
  | null // null is meant to represent a cancelled signature request

export type SwapEvent = {
  type: string
  data: unknown
  error?: string
}

export type SwapWidgetProps = {
  theme?: "dark" | "light"
  tokenList: BaseTokenInfo[]
  onEmit?: (event: SwapEvent) => void
  signMessage: (params: WalletMessage) => Promise<WalletSignatureResult>
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
