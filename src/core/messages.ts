import type { WalletMessage } from "../types/swap"
import type { DefuseUserId } from "../utils/defuse"
import {
  type WithdrawParams,
  makeEmptyMessage,
  makeInnerSwapAndWithdrawMessage,
  makeInnerSwapMessage,
  makeSwapMessage,
} from "../utils/messageFactory"
import type { SignerCredentials } from "./formatters"
import { formatUserIdentity } from "./formatters"

export interface IntentMessageConfig {
  /**
   * User identifier either as DefuseUserId or SignerCredentials
   * If SignerCredentials is provided, it will be converted to DefuseUserId
   */
  signerId: DefuseUserId | SignerCredentials
  /**
   * Optional deadline timestamp in milliseconds
   * @default 5 minutes from now
   */
  deadlineTimestamp?: number
  /**
   * Optional nonce for tracking
   * @default random nonce
   */
  nonce?: Uint8Array
  /**
   * Optional referral code for tracking
   */
  referral?: string
  /**
   * Optional message to attach to the intent
   */
  memo?: string
}

export type WithdrawIntentMessageConfig = WithdrawParams

function resolveSignerId(
  signerId: DefuseUserId | SignerCredentials
): DefuseUserId {
  return typeof signerId === "string" ? signerId : formatUserIdentity(signerId)
}

/**
 * Creates an intent message for token swaps
 * @param swapConfig Array of [tokenAddress, amount] tuples representing the swap
 * @param options Message configuration options
 * @returns Intent message ready to be signed by a wallet
 */
export function createSwapIntentMessage(
  swapConfig: [string, bigint][],
  options: IntentMessageConfig
): WalletMessage {
  const innerMessage = makeInnerSwapMessage({
    tokenDeltas: swapConfig,
    signerId: resolveSignerId(options.signerId),
    deadlineTimestamp: options.deadlineTimestamp ?? minutesFromNow(5),
    referral: options.referral,
    memo: options.memo,
  })

  return makeSwapMessage({
    innerMessage,
    nonce: options.nonce,
  })
}

/**
 * Creates an intent message for withdrawal operations
 * @param withdrawConfig Withdrawal-specific configuration (target chain, amount, destination)
 * @param options General message options (signer, deadline, etc.)
 * @returns Intent message ready to be signed by a wallet
 */
export function createWithdrawIntentMessage(
  withdrawConfig: WithdrawIntentMessageConfig,
  options: IntentMessageConfig
): WalletMessage {
  const innerMessage = makeInnerSwapAndWithdrawMessage({
    tokenDeltas: null,
    withdrawParams: withdrawConfig,
    signerId: resolveSignerId(options.signerId),
    deadlineTimestamp: options.deadlineTimestamp ?? minutesFromNow(5),
  })

  return makeSwapMessage({
    innerMessage,
    nonce: options.nonce,
  })
}

/**
 * Creates an empty intent message that can be used for testing connections
 * @param options Message configuration options
 * @returns Intent message ready to be signed by a wallet
 */
export function createEmptyIntentMessage(
  options: IntentMessageConfig
): WalletMessage {
  return makeEmptyMessage({
    signerId: resolveSignerId(options.signerId),
    deadlineTimestamp: options.deadlineTimestamp ?? minutesFromNow(5),
    nonce: options.nonce,
  })
}

function minutesFromNow(minutes: number): number {
  return Date.now() + minutes * 60 * 1000
}
