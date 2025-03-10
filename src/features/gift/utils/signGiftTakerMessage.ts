import { base64 } from "@scure/base"
import { Err, Ok, type Result } from "@thames/monads"
import { KeyPair } from "near-api-js"
import type { DefuseUserId, SignerCredentials } from "../../../core/formatters"
import { formatUserIdentity } from "../../../core/formatters"
import type { NEP413SignatureData } from "../../../types/swap"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import {
  makeInnerTransferMessage,
  makeSwapMessage,
} from "../../../utils/messageFactory"
import { randomDefuseNonce } from "../../../utils/messageFactory"
import type { GiftTerms } from "./deriveGiftTerms"
import { hashing } from "./hashing"

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
    signerId: resolveSignerId(
      userAddressToDefuseUserId(giftTerms.userId, "near")
    ),
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

    const messageHash = await hashing(
      walletMessage.NEP413.message,
      walletMessage.NEP413.recipient,
      base64.encode(nonce),
      413
    )

    const signature = keyPair.sign(messageHash)

    return Ok({
      type: "NEP413",
      signatureData: {
        accountId: giftTerms.userId,
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
