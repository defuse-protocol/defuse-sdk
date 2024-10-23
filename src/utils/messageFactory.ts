import type { WalletMessage } from "../types"
import type {
  DefuseMessageFor_DefuseIntents,
  TokenAmountsForInt128,
} from "../types/defuse-contracts-types"

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
