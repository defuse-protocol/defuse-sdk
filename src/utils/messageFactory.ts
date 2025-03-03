import { sha256 } from "@noble/hashes/sha256"
import { base64 } from "@scure/base"
import { getAddress } from "viem"
import { settings } from "../config/settings"
import { logger } from "../logger"
import type {
  Intent,
  Nep413DefuseMessageFor_DefuseIntents,
} from "../types/defuse-contracts-types"
import type { WalletMessage } from "../types/swap"
import { assert } from "./assert"
import type { DefuseUserId } from "./defuse"

/**
 * @param tokenDeltas
 * @param signerId
 * @param deadlineTimestamp Unix timestamp in milliseconds
 * @param referral
 * @param memo
 */
export function makeInnerSwapMessage({
  tokenDeltas,
  signerId,
  deadlineTimestamp,
  referral,
  memo,
}: {
  tokenDeltas: [string, bigint][]
  signerId: DefuseUserId
  deadlineTimestamp: number
  referral?: string
  memo?: string
}): Nep413DefuseMessageFor_DefuseIntents {
  const tokenDiff: Record<string, string> = {}
  const tokenDiffNum: Record<string, bigint> = {}

  for (const [token, amount] of tokenDeltas) {
    tokenDiffNum[token] ??= 0n
    tokenDiffNum[token] += amount
    // biome-ignore lint/style/noNonNullAssertion: it is checked above
    tokenDiff[token] = tokenDiffNum[token]!.toString()
  }

  if (Object.keys(tokenDiff).length === 0) {
    logger.warn("Empty diff")
    return {
      deadline: new Date(deadlineTimestamp).toISOString(),
      intents: [],
      signer_id: signerId,
    }
  }

  return {
    deadline: new Date(deadlineTimestamp).toISOString(),
    intents: [
      {
        intent: "token_diff",
        diff: tokenDiff,
        referral,
        memo,
      },
    ],
    signer_id: signerId,
  }
}

/**
 * @param tokenDeltas
 * @param withdrawParams
 * @param signerId
 * @param deadlineTimestamp Unix timestamp in seconds
 * @param referral
 */
export function makeInnerSwapAndWithdrawMessage({
  tokenDeltas,
  withdrawParams,
  signerId,
  deadlineTimestamp,
  referral,
}: {
  tokenDeltas: [string, bigint][] | null
  withdrawParams: WithdrawParams
  signerId: DefuseUserId
  deadlineTimestamp: number
  referral?: string
}): Nep413DefuseMessageFor_DefuseIntents {
  const intents: NonNullable<Nep413DefuseMessageFor_DefuseIntents["intents"]> =
    []

  if (tokenDeltas && tokenDeltas.length > 0) {
    const { intents: swapIntents } = makeInnerSwapMessage({
      tokenDeltas,
      signerId,
      deadlineTimestamp,
      referral,
    })
    assert(swapIntents, "swapIntents must be defined")
    intents.push(...swapIntents)
  }

  intents.push(makeInnerWithdrawMessage(withdrawParams))

  return {
    deadline: new Date(deadlineTimestamp).toISOString(),
    intents: intents,
    signer_id: signerId,
  }
}

export type WithdrawParams =
  | {
      type: "to_near"
      amount: bigint
      tokenAccountId: string
      receiverId: string
      storageDeposit: bigint
    }
  | {
      type: "via_poa_bridge"
      amount: bigint
      tokenAccountId: string
      destinationAddress: string
      destinationMemo: string | null
    }
  | {
      type: "to_aurora_engine"
      amount: bigint
      tokenAccountId: string
      auroraEngineContractId: string
      destinationAddress: string
    }

function makeInnerWithdrawMessage(params: WithdrawParams): Intent {
  const paramsType = params.type
  switch (paramsType) {
    case "to_near":
      if (params.tokenAccountId === "wrap.near") {
        return {
          intent: "native_withdraw",
          receiver_id: params.receiverId,
          amount: params.amount.toString(),
        }
      }
      return {
        intent: "ft_withdraw",
        token: params.tokenAccountId,
        receiver_id: params.receiverId,
        amount: params.amount.toString(),
        storage_deposit:
          params.storageDeposit > 0n
            ? params.storageDeposit.toString()
            : undefined,
      }

    case "via_poa_bridge": {
      const memo = ["WITHDRAW_TO", params.destinationAddress]
      if (params.destinationMemo) {
        memo.push(params.destinationMemo)
      }

      return {
        intent: "ft_withdraw",
        token: params.tokenAccountId,
        receiver_id: params.tokenAccountId,
        amount: params.amount.toString(),
        memo: memo.join(":"),
      }
    }

    case "to_aurora_engine":
      return {
        intent: "ft_withdraw",
        token: params.tokenAccountId,
        receiver_id: params.auroraEngineContractId,
        amount: params.amount.toString(),
        msg: makeAuroraEngineDepositMsg(params.destinationAddress),
      }

    default:
      paramsType satisfies never
      throw new Error(`Unknown withdraw type: ${paramsType}`)
  }
}

export function makeSwapMessage({
  innerMessage,
  nonce = randomDefuseNonce(),
}: {
  innerMessage: Nep413DefuseMessageFor_DefuseIntents
  nonce?: Uint8Array
}): WalletMessage {
  const payload = {
    signer_id: innerMessage.signer_id,
    verifying_contract: settings.defuseContractId,
    deadline: innerMessage.deadline,
    nonce: base64.encode(nonce),
    intents: innerMessage.intents,
  }
  const payloadSerialized = JSON.stringify(payload)
  const payloadBytes = new TextEncoder().encode(payloadSerialized)

  return {
    NEP413: {
      message: JSON.stringify(innerMessage),
      // This is who will be verifying the message
      recipient: settings.defuseContractId,
      nonce,
    },
    ERC191: {
      message: JSON.stringify(payload, null, 2),
    },
    SOLANA: {
      message: payloadBytes,
    },
    WEBAUTHN: {
      challenge: makeChallenge(payloadBytes),
      payload: payloadSerialized,
      parsedPayload: payload,
    },
  }
}

export function makeEmptyMessage({
  signerId,
  deadlineTimestamp,
  nonce = randomDefuseNonce(),
}: {
  signerId: DefuseUserId
  deadlineTimestamp: number
  nonce?: Uint8Array
}): WalletMessage {
  const innerMessage: Nep413DefuseMessageFor_DefuseIntents = {
    deadline: new Date(deadlineTimestamp).toISOString(),
    intents: [],
    signer_id: signerId,
  }

  return makeSwapMessage({
    innerMessage,
    nonce,
  })
}

export function randomDefuseNonce(): Uint8Array {
  return randomBytes(32)
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

/**
 * In order to deposit to AuroraEngine powered chain, we need to have a `msg`
 * with the destination address in special format (lower case + without 0x).
 */
function makeAuroraEngineDepositMsg(recipientAddress: string): string {
  const parsedRecipientAddress = getAddress(recipientAddress)
  return parsedRecipientAddress.slice(2).toLowerCase()
}

/**
 * Converts UTF-8 string to bytes for WebAuthn challenge
 */
export function makeChallenge(payload: Uint8Array): Uint8Array {
  // It's possible to use native crypto, but it's async, and this would break existing flow:
  // await crypto.subtle.digest("SHA-256", messageBytes)
  const hash = sha256(payload)
  return new Uint8Array(hash)
}

export function makeInnerTransferMessage({
  tokenDeltas,
  signerId,
  deadlineTimestamp,
  receiverId,
  memo,
}: {
  tokenDeltas: [string, bigint][]
  signerId: DefuseUserId
  deadlineTimestamp: number
  receiverId: string
  memo?: string
}): Nep413DefuseMessageFor_DefuseIntents {
  const tokens: Record<string, string> = {}

  for (const [token, amount] of tokenDeltas) {
    tokens[token] = amount.toString()
  }

  return {
    deadline: new Date(deadlineTimestamp).toISOString(),
    intents: [
      {
        intent: "transfer",
        tokens,
        receiver_id: receiverId,
        memo,
      },
    ],
    signer_id: signerId,
  }
}
