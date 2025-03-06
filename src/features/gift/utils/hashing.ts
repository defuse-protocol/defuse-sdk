import { BorshSchema, borshSerialize } from "borsher"

export enum SignStandardEnum {
  nep413 = "nep413",
}

export interface ITokenDiff {
  intent: "token_diff"
  diff: { [key: string]: string }
}

export type IIntent = ITokenDiff

export interface IMessage {
  signer_id: string
  deadline: string
  intents: IIntent[]
}

const standardNumber = {
  [SignStandardEnum.nep413]: 413,
}

const nep413PayloadSchema = BorshSchema.Struct({
  message: BorshSchema.String,
  nonce: BorshSchema.Array(BorshSchema.u8, 32),
  recipient: BorshSchema.String,
  callback_url: BorshSchema.Option(BorshSchema.String),
})

export async function serializeIntent(
  intentMessage: unknown,
  recipient: string,
  nonce: string,
  standard: SignStandardEnum
): Promise<Buffer> {
  if (!standardNumber[standard])
    throw new Error(`Unsupported standard: ${standard}`)
  const payload = {
    message: intentMessage,
    nonce: new Uint8Array(32),
    recipient,
  }
  const nonceData = Buffer.from(nonce, "base64")
  payload.nonce.set(nonceData.slice(0, 32))
  const payloadSerialized = borshSerialize(nep413PayloadSchema, payload)
  const baseInt = 2 ** 31 + standardNumber[standard]
  const baseIntSerialized = borshSerialize(BorshSchema.u32, baseInt)
  const combinedData = Buffer.concat([baseIntSerialized, payloadSerialized])

  const hashBuffer = await crypto.subtle.digest("SHA-256", combinedData)
  return Buffer.from(hashBuffer)
}
