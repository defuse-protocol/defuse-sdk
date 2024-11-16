import type { Address, Hash } from "viem"
import type { SwappableToken } from "../types"

export type ChainType = "near" | "evm"

export const ChainType = {
  Near: "near",
  EVM: "evm",
} as const

export type UserInfo = {
  userAddress?: string
  chainType?: ChainType
}

export type DepositWidgetProps = UserInfo & {
  tokenList: SwappableToken[]
  sendTransactionNear: (tx: Transaction["NEAR"][]) => Promise<Hash | null>
  sendTransactionEVM: (tx: Transaction["EVM"]) => Promise<Hash | null>
}

export type Transaction = {
  NEAR: SendTransactionNearParams
  EVM: SendTransactionEVMParams
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

export interface SendTransactionNearParams {
  receiverId: string
  actions: Array<Action>
}

export interface SendTransactionEVMParams {
  to: Address
  data: Hash
  value?: bigint
}

export interface BaseAssetInfo {
  address: string
  decimals: number
  icon: string
  symbol: string
}

export type DepositSnapshot = {
  txHash: Hash
}
