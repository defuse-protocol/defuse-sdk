import type { BaseTokenInfo } from "../../types/base"
import type { IntentsUserId } from "../../types/intentsUserId"
import { tokenAccountIdToDefuseAssetId } from "../../utils/tokenUtils"
import { getDepositStatus, type types } from "./poaBridgeHttpClient"

type TokenBalances = Record<BaseTokenInfo["defuseAssetId"], bigint>

export type GetPendingDepositsOkType = TokenBalances

export type GetPendingDepositsErrorType = types.JSONRPCErrorType

export async function getPendingDeposits(
  accountId: IntentsUserId
): Promise<GetPendingDepositsOkType> {
  const depositStatus = await getDepositStatus({
    account_id: accountId,
  })

  const pendingDeposits: TokenBalances = {}

  for (const deposit of depositStatus.deposits) {
    // POA bridge returns token IDs without the 'nep141:' prefix (e.g. 'base.omft.near')
    const defuseAssetId = tokenAccountIdToDefuseAssetId(deposit.near_token_id)

    if (deposit.status === "PENDING") {
      pendingDeposits[defuseAssetId] = BigInt(deposit.amount)
    }
  }

  return pendingDeposits
}
