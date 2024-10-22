import type { BaseTokenInfo, UnifiedTokenInfo } from "./base"

// Message for EVM wallets
export type EIP712Message = {
  // todo: update to real field, now it's just a placeholder
  json: string
}

export type EIP712SignatureData = {
  type: "EIP712"
  signatureData: string
}

// Message for NEAR wallets
export type NEP141Message = {
  message: string
  recipient: string
  nonce: Uint8Array
  callbackUrl?: string
}

export type NEP141SignatureData = {
  type: "NEP141"
  signatureData: {
    accountId: string
    /**
     * Base58-encoded signature with curve prefix. Example:
     * ed25519:Gxa24TGbJu4mqdhW3GbvLXmf4bSEyxVicrtpChDWbgga
     */
    publicKey: string
    /** Base64-encoded signature */
    signature: string
  }
  /**
   * The exact data that was signed. Wallet connectors may modify this during the signing process,
   * so this property contains the actual data that was signed by the wallet.
   */
  signedData: NEP141Message
}

export type WalletMessage = {
  EIP712: EIP712Message
  NEP141: NEP141Message
}

export type WalletSignatureResult = EIP712SignatureData | NEP141SignatureData

export type SwapEvent = {
  type: string
  data: unknown
  error?: string
}

export type SwappableToken = BaseTokenInfo | UnifiedTokenInfo

export type SwapWidgetProps = {
  theme?: "dark" | "light"
  tokenList: SwappableToken[]
  onEmit?: (event: SwapEvent) => void

  /**
   * The address (address for EVM, accountId for NEAR) of the user performing the swap.
   * `null` if the user is not authenticated.
   */
  userAddress: string | null

  signMessage: (params: WalletMessage) => Promise<WalletSignatureResult | null>
  onSuccessSwap: (params: {
    amountIn: bigint
    amountOut: bigint
    tokenIn: SwappableToken
    tokenOut: SwappableToken
  }) => void
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
