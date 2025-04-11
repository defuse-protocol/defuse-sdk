import type { providers } from "near-api-js"
import type { BaseTokenInfo } from "../types/base"
import type { IntentsUserId } from "../types/intentsUserId"
import { tokenAccountIdToDefuseAssetId } from "../utils/tokenUtils"
import { batchBalanceOf } from "./intentsContractService"
import { getDepositStatus } from "./poaBridgeHttpClient"

type TokenBalances = Record<BaseTokenInfo["defuseAssetId"], bigint>

export async function getDepositedBalances(
  accountId: IntentsUserId,
  tokenIds: BaseTokenInfo["defuseAssetId"][],
  nearClient: providers.Provider
): Promise<TokenBalances> {
  const amounts = await batchBalanceOf({
    nearClient,
    accountId,
    tokenIds,
  })

  // Transforming response
  const result: TokenBalances = {}
  for (let i = 0; i < tokenIds.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: always within bounds
    result[tokenIds[i]!] = BigInt(amounts[i]!)
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

  const pendingDeposits: TokenBalances = {}

  for (const deposit of depositStatus.deposits) {
    // POA bridge returns token IDs without the 'nep141:' prefix (e.g. 'base.omft.near')
    const defuseAssetId = tokenAccountIdToDefuseAssetId(deposit.near_token_id)

    if (tokenIds.includes(defuseAssetId) && deposit.status === "PENDING") {
      pendingDeposits[defuseAssetId] = BigInt(deposit.amount)
    }
  }

  return pendingDeposits
}
