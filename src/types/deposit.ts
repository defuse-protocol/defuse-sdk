import type { Transaction as TransactionSolana } from "@solana/web3.js"
import type { Address, Hash } from "viem"
import type { SwappableToken } from "./swap"

export type AuthMethod = "near" | "evm" | "solana" | "webauthn"

export const AuthMethod = {
  Near: "near",
  EVM: "evm",
  Solana: "solana",
  WebAuthn: "webauthn",
} as const

/**
 * Represents a public identifier used for authentication.
 * This could be a blockchain address, account name, or public key.
 * This is always a public value - never contains private keys or passwords.
 */
export type AuthIdentifier = string

export type AuthHandle = {
  identifier: AuthIdentifier
  method: AuthMethod
}

export type DepositWidgetProps = {
  userAddress: AuthHandle["identifier"] | undefined
  chainType: AuthHandle["method"] | undefined

  tokenList: SwappableToken[]
  sendTransactionNear: (tx: Transaction["NEAR"][]) => Promise<string | null>
  sendTransactionEVM: (tx: Transaction["EVM"]) => Promise<Hash | null>
  sendTransactionSolana: (tx: Transaction["Solana"]) => Promise<string | null>
}

export type Transaction = {
  NEAR: SendTransactionNearParams
  EVM: SendTransactionEVMParams
  Solana: SendTransactionSolanaParams
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
  from: Address
  to: Address
  chainId: number
  data: Hash
  value?: bigint
  gasPrice?: bigint
  gas?: bigint
}

export interface SendTransactionSolanaParams extends TransactionSolana {}
