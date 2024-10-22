import type { WalletMessage } from "../types"
import type {
  DefuseMessageFor_DefuseIntents,
  TokenAmountsForInt128,
} from "../types/defuse-contracts-types"

export function makeInnerSwapMessage({
  tokenDiff,
  signerId,
  deadlineTimestamp,
}: {
  tokenDiff: [string, bigint][]
  signerId: string
  deadlineTimestamp: number
}): DefuseMessageFor_DefuseIntents {
  const serializedTokenDiff = tokenDiff.reduce((acc, [tokenId, amount]) => {
    acc[tokenId] = amount.toString()
    return acc
  }, {} as TokenAmountsForInt128)

  return {
    deadline: { timestamp: deadlineTimestamp },
    intents: [
      {
        intent: "token_diff",
        diff: serializedTokenDiff,
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
