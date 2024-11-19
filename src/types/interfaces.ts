import type { Result } from "./solver"

export type DefuseBaseIds = {
  defuse_asset_id: string
  blockchain: string
}

export type Account = {
  amount: string
  storage_usage: number
  account_id: string
}

export enum TokenConvertEnum {
  USD = "usd",
}

export type TokenBalance = {
  balance?: string
  balanceUsd?: number
  convertedLast?: {
    [key in TokenConvertEnum]: number
  }
}

export interface TokenInfo extends TokenBalance {
  address: string
  symbol: string
  name: string
  decimals: number
  icon?: string
}

export interface NetworkToken extends TokenInfo, DefuseBaseIds {
  chainId?: string
  chainIcon?: string
  chainName?: string
}

export enum QueueTransactions {
  DEPOSIT = "deposit",
  WITHDRAW = "withdraw",
  STORAGE_DEPOSIT_TOKEN_IN = "storageDepositTokenIn",
  STORAGE_DEPOSIT_TOKEN_OUT = "storageDepositTokenOut",
  CREATE_INTENT = "createIntent",
}

export interface NearTXTransaction {
  hash: string
  actions: {
    FunctionCall: {
      method_name: string
      args: string
      deposit: string
    }
  }[]
  signer_id: string
  receiver_id: string
}

export type NearTxReceiptsOutcomeFailure = {
  ActionError: {
    index: number
    kind: {
      FunctionCallError: {
        ExecutionError: string
      }
    }
  }
}

export type NearTxReceiptsOutcome = {
  block_hash: string
  id: string
  outcome: {
    logs: string[]
    status: {
      SuccessReceiptId?: string
      SuccessValue?: string
      Failure?: NearTxReceiptsOutcomeFailure
    }
  }
}[]

export type NearTXError = {
  message: string
  data: string
}

export type NearTX = {
  transaction: NearTXTransaction
  receipts_outcome: NearTxReceiptsOutcome
}

export interface NearHeader {
  height: number
  prev_height: number
  timestamp: number
}

export type NearBlock = Result<{
  chunks: unknown
  header: NearHeader
}>

export enum AssetTypeEnum {
  nep141 = "nep141",
  native = "native",
  cross_chain = "cross_chain",
}

export type AbstractAsset = {
  type: AssetTypeEnum
  oracle?: string
  asset?: string
  token?: string
}

export type IntentAsset = {
  amount: string
  account: string
} & AbstractAsset

export type NearIntentStatus = {
  asset_in: IntentAsset
  asset_out: IntentAsset
  lockup_until: {
    block_number: number
  }
  expiration: {
    block_number: number
  }
  status: string
  referral: string
  proof?: string
}

type TransferToken = {
  token_id: string
  amount: string
}

type ExpirationEnum = {
  Null: string
  Time: string
  Block: string
}

export interface NearIntentCreate {
  CreateIntent: {
    id: string
    IntentStruct: {
      initiator: string
      send: TransferToken
      receive: TransferToken
      expiration: ExpirationEnum
      referral: string
    }
  }
}

export interface NearIntent1CreateCrossChain {
  type: "create"
  id: string
  asset_out: {
    type: "cross_chain"
    oracle: string
    asset: string
    amount: string
    account: string
  }
  lockup_until: {
    block_number: number
  }
  expiration: {
    block_number: number
  }
  referral: string
}

export interface NearIntent1CreateSingleChain {
  type: "create"
  id: string
  asset_out: {
    type: "nep141" | "native"
    token: string
    amount: string
    account: string
  }
  lockup_until: {
    block_number: number
  }
  expiration: {
    block_number: number
  }
  referral: string
}

export interface RecoverDetails {
  initiator: string
  send: TransferToken
  receive: TransferToken
  expiration: ExpirationEnum
  referral: string
  msg?: string
  amount?: string
  receiverId?: string
}

export type JobsDetails = {
  team?: string
  applicationLink?: boolean
  position: string
  link: string
}

export interface NearViewAccount {
  amount: string
  block_hash: string
  block_height: number
  code_hash: string
  locked: string
  storage_paid_at: number
  storage_usage: number
}

export interface BitcoinBalanceEntity {
  hash160: string
  address: string
  n_tx: number
  n_unredeemed: number
  total_received: number
  total_sent: number
  final_balance: number
}

export interface BitcoinPriceInUsdEntity {
  bitcoin: {
    usd: number
  }
}

/**
 * Values are POA Bridge specific
 * todo: use SupportedChainName as keys
 */
export enum BlockchainEnum {
  NEAR = "near:mainnet",
  ETHEREUM = "eth:1",
  BASE = "eth:8453",
  ARBITRUM = "eth:42161",
  BITCOIN = "btc:mainnet",
  SOLANA = "sol:mainnet",
}
