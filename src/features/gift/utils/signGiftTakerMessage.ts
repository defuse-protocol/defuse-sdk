import { base64 } from "@scure/base"
import { Err, Ok, type Result } from "@thames/monads"
import { KeyPair } from "near-api-js"
import type { DefuseUserId, SignerCredentials } from "../../../core/formatters"
import { formatUserIdentity } from "../../../core/formatters"
import type { NEP413SignatureData } from "../../../types/swap"
import {
  makeInnerTransferMessage,
  makeSwapMessage,
} from "../../../utils/messageFactory"
import { randomDefuseNonce } from "../../../utils/messageFactory"
import type { GiftTerms } from "./deriveGiftTerms"
import { SignStandardEnum, serializeIntent } from "./hashing"

export async function signGiftTakerMessage({
  giftTerms,
  signerCredentials,
}: {
  giftTerms: GiftTerms
  signerCredentials: SignerCredentials | null
}): Promise<Result<NEP413SignatureData, string>> {
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
    const keyPair = KeyPair.fromString(`ed25519:${giftTerms.secretKey}`)

    // biome-ignore lint/suspicious/noConsole: <explanation>
    console.log("walletMessage.NEP413", walletMessage.NEP413)

    const serialize = await serializeIntent(
      walletMessage.NEP413.message,
      walletMessage.NEP413.recipient,
      base64.encode(nonce),
      SignStandardEnum.nep413
    )

    const signature = keyPair.sign(serialize)

    return Ok({
      type: "NEP413",
      signatureData: {
        accountId: giftTerms.walletId,
        publicKey: keyPair.getPublicKey().toString(),
        signature: base64.encode(signature.signature),
      },
      signedData: walletMessage.NEP413,
    })
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
