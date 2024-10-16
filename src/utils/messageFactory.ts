import type { WalletMessage } from "../types"
import type {
  DefuseMessageFor_DefuseIntents,
  TokenAmountsForInt128,
} from "../types/defuse-contracts-types"

export function makeSwapMessage({
  tokenDiff,
  signerId,
  recipient,
  deadlineTimestamp,
  nonce = randomBytes(32),
}: {
  tokenDiff: [string, bigint][]
  signerId: string
  recipient: string
  deadlineTimestamp: number
  nonce?: Uint8Array
}): WalletMessage {
  const serializedTokenDiff = tokenDiff.reduce((acc, [tokenId, amount]) => {
    acc[tokenId] = amount.toString()
    return acc
  }, {} as TokenAmountsForInt128)

  const nep141Message: DefuseMessageFor_DefuseIntents = {
    deadline: { timestamp: deadlineTimestamp },
    intents: [
      {
        intent: "token_diff",
        diff: serializedTokenDiff,
      },
    ],
    signer_id: signerId,
  }

  return {
    NEP141: {
      message: JSON.stringify(nep141Message),
      recipient,
      nonce,
    },
    EIP712: {
      // todo: This is a temporary implementation
      json: "{}",
    },
  }
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}
