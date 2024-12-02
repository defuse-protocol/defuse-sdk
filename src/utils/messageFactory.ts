import { base64 } from "@scure/base"
import { settings } from "../config/settings"
import type { WalletMessage } from "../types"
import type {
  AccountId,
  Intent,
  Nep413DefuseMessageFor_DefuseIntents,
  TokenAmountsForInt128,
} from "../types/defuse-contracts-types"
import { assert } from "./assert"
import type { DefuseUserId } from "./defuse"

export function makeInnerSwapMessage({
  tokenDeltas,
  signerId,
  deadlineTimestamp,
}: {
  tokenDeltas: [string, bigint][]
  signerId: DefuseUserId
  deadlineTimestamp: number
}): Nep413DefuseMessageFor_DefuseIntents {
  const tokenDiff: TokenAmountsForInt128 = {}
  const tokenDiffNum: Record<string, bigint> = {}

  for (const [token, amount] of tokenDeltas) {
    tokenDiffNum[token] ??= 0n
    tokenDiffNum[token] += amount
    // biome-ignore lint/style/noNonNullAssertion: it is checked above
    tokenDiff[token] = tokenDiffNum[token]!.toString()
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
  tokenDeltas,
  withdrawParams,
  signerId,
  deadlineTimestamp,
}: {
  tokenDeltas: [string, bigint][] | null
  withdrawParams: WithdrawParams
  signerId: DefuseUserId
  deadlineTimestamp: number
}): Nep413DefuseMessageFor_DefuseIntents {
  const intents: NonNullable<Nep413DefuseMessageFor_DefuseIntents["intents"]> =
    []

  if (tokenDeltas && tokenDeltas.length > 0) {
    const { intents: swapIntents } = makeInnerSwapMessage({
      tokenDeltas,
      signerId,
      deadlineTimestamp,
    })
    assert(swapIntents, "swapIntents must be defined")
    intents.push(...swapIntents)
  }

  intents.push(makeInnerWithdrawMessage(withdrawParams) as Intent)

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
      storageDeposit: bigint
    }
  | {
      type: "via_poa_bridge"
      amount: bigint
      tokenAccountId: string
      destinationAddress: string
    }

type NativeWithdrawIntent = {
  intent: "native_withdraw"
  amount: string
  receiver_id: AccountId
}

function makeInnerWithdrawMessage(
  params: WithdrawParams
): Intent | NativeWithdrawIntent {
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

    case "via_poa_bridge":
      return {
        intent: "ft_withdraw",
        token: params.tokenAccountId,
        receiver_id: params.tokenAccountId,
        amount: params.amount.toString(),
        memo: `WITHDRAW_TO:${params.destinationAddress}`,
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
  innerMessage: Nep413DefuseMessageFor_DefuseIntents
  recipient: string
  nonce?: Uint8Array
}): WalletMessage {
  return {
    NEP413: {
      message: JSON.stringify(innerMessage),
      recipient,
      nonce,
    },
    ERC191: {
      message: JSON.stringify(
        {
          signer_id: innerMessage.signer_id,
          verifying_contract: settings.defuseContractId,
          deadline: innerMessage.deadline,
          nonce: base64.encode(nonce),
          intents: innerMessage.intents,
        },
        null,
        2
      ),
    },
    SOLANA: {
      message: new TextEncoder().encode(
        JSON.stringify({
          signer_id: innerMessage.signer_id,
          verifying_contract: settings.defuseContractId,
          deadline: innerMessage.deadline,
          nonce: base64.encode(nonce),
          intents: innerMessage.intents,
        })
      ),
    },
  }
}

function randomDefuseNonce(): Uint8Array {
  return randomBytes(32)
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}
