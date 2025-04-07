import type { providers } from "near-api-js"
import * as v from "valibot"
import { config } from "../config"
import type { BaseTokenInfo } from "../types/base"
import type { IntentsUserId } from "../types/intentsUserId"
import { decodeQueryResult } from "../utils/near"
import { getDepositStatus } from "./poaBridgeHttpClient"

type TokenBalances = Record<BaseTokenInfo["defuseAssetId"], bigint>

export async function getDepositedBalances(
  accountId: IntentsUserId,
  tokenIds: BaseTokenInfo["defuseAssetId"][],
  nearClient: providers.Provider
): Promise<TokenBalances> {
  const response = await nearClient.query({
    request_type: "call_function",
    account_id: config.env.contractID,
    method_name: "mt_batch_balance_of",
    args_base64: btoa(
      JSON.stringify({
        account_id: accountId,
        token_ids: tokenIds,
      })
    ),
    finality: "optimistic",
  })

  const parsed = decodeQueryResult(response, v.array(v.string()))

  // Transforming response
  const result: TokenBalances = {}
  for (let i = 0; i < tokenIds.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: always within bounds
    result[tokenIds[i]!] = BigInt(parsed[i]!)
  }

  return result
}

export async function getTransitBalances(
  accountId: IntentsUserId,
  tokenIds: BaseTokenInfo["defuseAssetId"][]
): Promise<TokenBalances> {
  const depositStatus = await getDepositStatus({
    account_id: accountId,
  })

  const result: TokenBalances = {}
  for (const deposit of depositStatus.deposits) {
    if (
      // POA bridge returns token IDs without the 'nep141:' prefix (e.g. 'base.omft.near')
      tokenIds.includes(`nep141:${deposit.near_token_id}`) &&
      deposit.status === "PENDING"
    ) {
      result[`nep141:${deposit.near_token_id}`] = BigInt(deposit.amount)
    }
  }

  return result
}
