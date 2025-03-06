import { BorshSchema, borshSerialize } from "borsher"

export enum SignStandardEnum {
  nep413 = "nep413",
}

const standardNumber = {
  [SignStandardEnum.nep413]: 413,
}

interface ITokenDiff {
  intent: "token_diff"
  diff: { [key: string]: string }
}

type IIntent = ITokenDiff

/**
 * Message structure for signing
 */
export interface IMessage {
  signer_id: string
  deadline: string
  intents: IIntent[]
}

/**
 * Borsh schema for NEP-413 payload serialization
 */
const nep413PayloadSchema = BorshSchema.Struct({
  message: BorshSchema.String,
  nonce: BorshSchema.Array(BorshSchema.u8, 32),
  recipient: BorshSchema.String,
  callback_url: BorshSchema.Option(BorshSchema.String),
})

/**
 * Client-side utility to serialize and hash NEP-413 messages for EdDSA signature verification.
 * Follows the NEP-413 specification for message serialization and hashing:
 * @see https://github.com/near/NEPs/blob/master/neps/nep-0413.md#specification
 *
 * The resulting hash should be used with EdDSA signing to create a valid NEP-413 signature.
 * Note: This is a browser-only implementation using Web Crypto API.
 *
 * @param intentMessage - Message content to be signed
 * @param recipient - Recipient account ID
 * @param nonce - Base64 encoded 32-byte nonce
 * @param standard - Signature standard (currently only NEP-413)
 * @returns Promise resolving to Buffer containing message hash for signing
 */
export async function serializeIntent(
  intentMessage: unknown,
  recipient: string,
  nonce: string,
  standard: SignStandardEnum
): Promise<Buffer> {
  if (!standardNumber[standard]) {
    throw new Error(`Unsupported standard: ${standard}`)
  }

  // Prepare payload with fixed-size nonce array
  const payload = {
    message: intentMessage,
    nonce: new Uint8Array(32),
    recipient,
  }
  const nonceData = Buffer.from(nonce, "base64")
  payload.nonce.set(nonceData.subarray(0, 32))

  // Serialize payload and combine with standard identifier
  const payloadSerialized = borshSerialize(nep413PayloadSchema, payload)
  const baseInt = 2 ** 31 + standardNumber[standard]
  const baseIntSerialized = borshSerialize(BorshSchema.u32, baseInt)
  const combinedData = Buffer.concat([baseIntSerialized, payloadSerialized])

  // Hash the combined data
  const hashBuffer = await crypto.subtle.digest("SHA-256", combinedData)
  return Buffer.from(hashBuffer)
}
