import type { providers } from "near-api-js"
import type { CodeResult } from "near-api-js/lib/providers/provider"
import { isBaseToken } from "src/utils/token"
import { settings } from "../config/settings"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../types/base"
import { assert } from "../utils/assert"
import type { DefuseUserId } from "../utils/defuse"
import { getDepositStatus } from "./poaBridgeClient"

type TokenBalances = Record<BaseTokenInfo["defuseAssetId"], bigint>

export async function getDepositedBalances(
  accountId: DefuseUserId,
  tokenIds: BaseTokenInfo["defuseAssetId"][],
  nearClient: providers.Provider
): Promise<TokenBalances> {
  // RPC call
  // Warning: `CodeResult` is not correct type for `call_function`, but it's closest we have.
  const output = await nearClient.query<CodeResult>({
    request_type: "call_function",
    account_id: settings.defuseContractId,
    method_name: "mt_batch_balance_of",
    args_base64: btoa(
      JSON.stringify({
        account_id: accountId,
        token_ids: tokenIds,
      })
    ),
    finality: "optimistic",
  })

  // Decoding response
  const uint8Array = new Uint8Array(output.result)
  const decoder = new TextDecoder()
  const parsed = JSON.parse(decoder.decode(uint8Array))

  // Validating response
  assert(
    Array.isArray(parsed) && parsed.every((a) => typeof a === "string"),
    "Invalid response"
  )
  assert(parsed.length === tokenIds.length, "Invalid response")

  // Transforming response
  const result: TokenBalances = {}
  for (let i = 0; i < tokenIds.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: always within bounds
    result[tokenIds[i]!] = BigInt(parsed[i])
  }

  return result
}

export async function getTransitBalances(
  accountId: DefuseUserId,
  tokenIds: BaseTokenInfo["defuseAssetId"][],
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
): Promise<TokenBalances> {
  const depositStatus = await getDepositStatus({
    account_id: accountId,
  })

  const tokenAddressToDefuseAssetId = tokenList.reduce(
    (acc, token) => {
      if (isBaseToken(token)) {
        acc[token.address.toLowerCase()] = token.defuseAssetId
      } else {
        for (const t of token.groupedTokens) {
          acc[t.address.toLowerCase()] = t.defuseAssetId
        }
      }
      return acc
    },
    {} as Record<string, string>
  )

  const result: TokenBalances = {}
  for (const deposit of depositStatus.deposits) {
    // POA Bridge use specific format for defuse_asset_identifier [chain]:[token_address]
    const tokenAddress = deposit.defuse_asset_identifier
      .replace(`${deposit.chain}:`, "")
      .toLowerCase()
    const defuseAssetId = tokenAddressToDefuseAssetId[tokenAddress]

    if (
      defuseAssetId != null &&
      tokenIds.includes(defuseAssetId) &&
      deposit.status === "PENDING"
    ) {
      result[defuseAssetId] = BigInt(deposit.amount)
    }
  }

  return result
}
