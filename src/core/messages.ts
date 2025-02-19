import type { WalletMessage } from "../types/swap"
import type { DefuseUserId } from "../utils/defuse"
import {
  type WithdrawParams,
  makeEmptyMessage,
  makeInnerSwapAndWithdrawMessage,
  makeInnerSwapMessage,
  makeSwapMessage,
} from "../utils/messageFactory"

export interface IntentMessageOptions {
  /**
   * User identifier in the format required by Defuse protocol
   */
  signerId: DefuseUserId
  /**
   * Optional deadline timestamp in milliseconds
   * @default 5 minutes from now
   */
  deadlineTimestamp?: number
  /**
   * Optional referral code for tracking
   */
  referral?: string
}

export type WithdrawIntentConfig = WithdrawParams

/**
 * Creates an intent message for token swaps
 * @param swapConfig Array of [tokenAddress, amount] tuples representing the swap
 * @param options Message configuration options
 * @returns Intent message ready to be signed by a wallet
 */
export function createSwapIntentMessage(
  swapConfig: [string, bigint][],
  options: IntentMessageOptions
): WalletMessage {
  const innerMessage = makeInnerSwapMessage({
    tokenDeltas: swapConfig,
    signerId: options.signerId,
    deadlineTimestamp: options.deadlineTimestamp ?? minutesFromNow(5),
    referral: options.referral,
  })

  return makeSwapMessage({
    innerMessage,
  })
}

/**
 * Creates an intent message for withdrawal operations
 * @param withdrawConfig Withdrawal-specific configuration (target chain, amount, destination)
 * @param options General message options (signer, deadline, etc.)
 * @returns Intent message ready to be signed by a wallet
 */
export function createWithdrawIntentMessage(
  withdrawConfig: WithdrawIntentConfig,
  options: IntentMessageOptions
): WalletMessage {
  const innerMessage = makeInnerSwapAndWithdrawMessage({
    tokenDeltas: null,
    withdrawParams: withdrawConfig,
    signerId: options.signerId,
    deadlineTimestamp: options.deadlineTimestamp ?? minutesFromNow(5),
  })

  return makeSwapMessage({
    innerMessage,
  })
}

/**
 * Creates an empty intent message that can be used for testing connections
 * @param options Message configuration options
 * @returns Intent message ready to be signed by a wallet
 */
export function createEmptyIntentMessage(
  options: IntentMessageOptions
): WalletMessage {
  return makeEmptyMessage({
    signerId: options.signerId,
    deadlineTimestamp: options.deadlineTimestamp ?? minutesFromNow(5),
  })
}

function minutesFromNow(minutes: number): number {
  return Date.now() + minutes * 60 * 1000
}
