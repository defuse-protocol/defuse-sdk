import type { WalletMessage } from "../types"
import type {
  DefuseMessageFor_DefuseIntents,
  Intent,
  TokenAmountsForInt128,
} from "../types/defuse-contracts-types"
import { assert } from "./assert"

export const ONE_TGAS = 1_000000000000n

export function makeInnerSwapMessage({
  amountsIn,
  amountsOut,
  signerId,
  deadlineTimestamp,
}: {
  amountsIn: Record<string, bigint>
  amountsOut: Record<string, bigint>
  signerId: string
  deadlineTimestamp: number
}): DefuseMessageFor_DefuseIntents {
  const tokenDiff = {} as TokenAmountsForInt128

  for (const [token, amount] of Object.entries(amountsIn)) {
    tokenDiff[token] = (-amount).toString()
  }

  for (const [token, amount] of Object.entries(amountsOut)) {
    tokenDiff[token] = amount.toString()
  }

  if (Object.keys(tokenDiff).length === 0) {
    console.warn("Empty diff")
    return {
      deadline: { timestamp: deadlineTimestamp },
      intents: [],
      signer_id: signerId,
    }
  }

  return {
    deadline: { timestamp: deadlineTimestamp },
    intents: [
      {
        intent: "token_diff",
        diff: tokenDiff,
      },
    ],
    signer_id: signerId,
  }
}

export function makeInnerSwapAndWithdrawMessage({
  swapParams,
  withdrawParams,
  signerId,
  deadlineTimestamp,
}: {
  swapParams: {
    amountsIn: Record<string, bigint>
    amountsOut: Record<string, bigint>
  } | null
  withdrawParams: WithdrawParams
  signerId: string
  deadlineTimestamp: number
}): DefuseMessageFor_DefuseIntents {
  const intents: NonNullable<DefuseMessageFor_DefuseIntents["intents"]> = []

  if (swapParams) {
    const { intents: swapIntents } = makeInnerSwapMessage({
      amountsIn: swapParams.amountsIn,
      amountsOut: swapParams.amountsOut,
      signerId,
      deadlineTimestamp,
    })
    assert(swapIntents, "swapIntents must be defined")
    intents.push(...swapIntents)
  }

  intents.push(makeInnerWithdrawMessage(withdrawParams))

  return {
    deadline: { timestamp: deadlineTimestamp },
    intents: intents,
    signer_id: signerId,
  }
}

type WithdrawParams =
  | {
      type: "to_near"
      amount: bigint
      tokenAccountId: string
      receiverId: string
    }
  | {
      type: "via_poa_bridge"
      amount: bigint
      tokenAccountId: string
      destinationAddress: string
    }

function makeInnerWithdrawMessage(params: WithdrawParams): Intent {
  const paramsType = params.type
  switch (paramsType) {
    case "to_near":
      return {
        intent: "ft_withdraw",
        token: params.tokenAccountId,
        receiver_id: params.receiverId,
        amount: params.amount.toString(),
        gas: (15n * ONE_TGAS).toString(), // this is enough for a simple transfer
      }

    case "via_poa_bridge":
      return {
        intent: "ft_withdraw",
        token: params.tokenAccountId,
        receiver_id: params.tokenAccountId,
        amount: params.amount.toString(),
        memo: `WITHDRAW_TO:${params.destinationAddress}`,
        gas: (15n * ONE_TGAS).toString(), // this is enough for a simple transfer
      }

    default:
      paramsType satisfies never
      throw new Error(`Unknown withdraw type: ${paramsType}`)
  }
}

export function makeSwapMessage({
  innerMessage,
  recipient,
  nonce = randomDefuseNonce(),
}: {
  innerMessage: DefuseMessageFor_DefuseIntents
  recipient: string
  nonce?: Uint8Array
}): WalletMessage {
  return {
    NEP413: {
      message: JSON.stringify(innerMessage),
      recipient,
      nonce,
    },
    EIP712: {
      // todo: This is a temporary implementation
      json: "{}",
    },
  }
}

function randomDefuseNonce(): Uint8Array {
  return randomBytes(32)
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}
