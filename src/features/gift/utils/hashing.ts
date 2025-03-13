import { BorshSchema, borshSerialize } from "borsher"

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
 * Note: This is a browser-only implementation.
 *
 * @param intentMessage - Message content to be signed
 * @param recipient - Recipient account ID
 * @param nonce - Base64 encoded 32-byte nonce
 * @param standard - Signature standard (currently only NEP-413)
 * @returns Promise resolving to Buffer containing message hash for signing
 */
export async function hashing(
  intentMessage: unknown,
  recipient: string,
  nonce: Uint8Array,
  standard: number
): Promise<Uint8Array> {
  if (standard !== 413) {
    throw new Error(`Unsupported standard: ${standard}`)
  }

  const payload = {
    message: intentMessage,
    nonce: new Uint8Array(32),
    recipient,
  }
  payload.nonce.set(nonce.subarray(0, 32))

  // Serialize payload and combine with standard identifier
  const payloadSerialized = borshSerialize(nep413PayloadSchema, payload)
  const baseInt = 2 ** 31 + standard
  const baseIntSerialized = borshSerialize(BorshSchema.u32, baseInt)

  // Combine serialized data
  const combinedData = new Uint8Array(
    baseIntSerialized.length + payloadSerialized.length
  )
  combinedData.set(baseIntSerialized)
  combinedData.set(payloadSerialized, baseIntSerialized.length)

  // Hash the combined data
  const hashBuffer = await crypto.subtle.digest("SHA-256", combinedData)
  return new Uint8Array(hashBuffer)
}
