import { base64 } from "@scure/base"
import { Err, Ok, type Result } from "@thames/monads"
import { KeyPair } from "near-api-js"
import type { DefuseUserId, SignerCredentials } from "../../../core/formatters"
import { formatUserIdentity } from "../../../core/formatters"
import {
  makeInnerTransferMessage,
  makeSwapMessage,
} from "../../../utils/messageFactory"
import { randomDefuseNonce } from "../../../utils/messageFactory"
import type { GiftTerms } from "./deriveGiftTerms"

export function signGiftTakerMessage({
  giftTerms,
  signerCredentials,
}: {
  giftTerms: GiftTerms
  signerCredentials: SignerCredentials | null
}): Result<string, string> {
  if (signerCredentials == null) {
    return Err("CREDENTIALS_NOT_FOUND")
  }
  const nonce = randomDefuseNonce()

  const innerMessage = makeInnerTransferMessage({
    tokenDeltas: [...Object.entries(giftTerms.tokenDiff)],
    signerId: resolveSignerId(giftTerms.walletId as DefuseUserId),
    deadlineTimestamp: minutesFromNow(5),
    receiverId: signerCredentials.credential,
    memo: "GIFT_FILL",
  })
  const walletMessage = makeSwapMessage({
    innerMessage,
    nonce: nonce,
  })

  try {
    // TODO: generate secret within curve format on creation of gift link
    const keyPair = KeyPair.fromString(`ed25519:${giftTerms.secretKey}`)
    const signature = keyPair.sign(
      new TextEncoder().encode(walletMessage.NEP413.message)
    )
    return Ok(base64.encode(signature.signature))
  } catch (error) {
    return Err(
      `Failed to sign message: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

function minutesFromNow(minutes: number): number {
  return Date.now() + minutes * 60 * 1000
}

function resolveSignerId(
  signerId: DefuseUserId | SignerCredentials
): DefuseUserId {
  return typeof signerId === "string" ? signerId : formatUserIdentity(signerId)
}
