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
