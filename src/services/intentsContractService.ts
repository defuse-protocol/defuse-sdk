import type { providers } from "near-api-js"
import * as v from "valibot"
import { config } from "../config"
import { type OptionalBlockReference, queryContract } from "../utils/near"

export async function getProtocolFee(
  params: { nearClient: providers.Provider } & OptionalBlockReference
) {
  const data = await queryContract({
    ...params,
    contractId: config.env.contractID,
    methodName: "fee",
    args: {},
  })

  // in bip: 1 bip = 0.0001% = 0.000001
  return v.parse(v.number(), data)
}

export async function hasPublicKey({
  accountId,
  publicKey,
  ...params
}: {
  nearClient: providers.Provider
  accountId: string
  publicKey: string
} & OptionalBlockReference): Promise<boolean> {
  const data = await queryContract({
    ...params,
    contractId: config.env.contractID,
    methodName: "has_public_key",
    args: {
      account_id: accountId,
      public_key: publicKey,
    },
  })

  return v.parse(v.boolean(), data)
}

export async function isNonceUsed({
  accountId,
  nonce,
  ...params
}: {
  nearClient: providers.Provider
  accountId: string
  nonce: string
} & OptionalBlockReference): Promise<boolean> {
  const data = await queryContract({
    ...params,
    contractId: config.env.contractID,
    methodName: "is_nonce_used",
    args: {
      account_id: accountId,
      nonce: nonce,
    },
  })

  return v.parse(v.boolean(), data)
}
