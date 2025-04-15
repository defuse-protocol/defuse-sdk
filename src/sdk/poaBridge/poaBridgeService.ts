import { RpcRequestError } from "../../errors/request"
import type { BaseTokenInfo } from "../../types/base"
import type { IntentsUserId } from "../../types/intentsUserId"
import { assert, type AssertErrorType } from "../../utils/assert"
import { tokenAccountIdToDefuseAssetId } from "../../utils/tokenUtils"
import { wait } from "../../utils/wait"
import {
  getDepositStatus,
  getWithdrawalStatus,
  type types,
} from "../poaBridgeHttpClient"

export type WaitForWithdrawalCompletionOkType = {
  destinationTxHash: string
  chain: string
}

export type WaitForWithdrawalCompletionErrorType =
  | types.JSONRPCErrorType
  | AssertErrorType

export async function waitForWithdrawalCompletion({
  txHash,
  signal,
}: {
  txHash: string
  signal: AbortSignal
}): Promise<WaitForWithdrawalCompletionOkType> {
  const DEFAULT_WITHDRAWAL_STATUS_INTERVAL_MS = 500

  while (!signal.aborted) {
    const result = await getWithdrawalStatus({
      withdrawal_hash: txHash,
    }).catch((err) => {
      // WITHDRAWALS_NOT_FOUND error is transient, we should keep retrying
      if (isWithdrawalNotFound(err)) {
        return null
      }
      throw err
    })

    if (result != null) {
      const withdrawal = result.withdrawals[0]
      assert(withdrawal, "POA Bridge didn't return withdrawal")

      if (withdrawal.status === "COMPLETED") {
        // COMPLETED should have `transfer_tx_hash` always
        assert(
          withdrawal.data.transfer_tx_hash != null,
          "transfer_tx_hash is null"
        )

        return {
          destinationTxHash: withdrawal.data.transfer_tx_hash,
          chain: withdrawal.data.chain,
        }
      }
    }

    await wait(DEFAULT_WITHDRAWAL_STATUS_INTERVAL_MS)
  }

  throw signal.reason
}

function isWithdrawalNotFound(err: unknown) {
  const RPC_ERR_MSG_WITHDRAWALS_NOT_FOUND = "Withdrawals not found"
  return (
    err instanceof RpcRequestError &&
    err.details === RPC_ERR_MSG_WITHDRAWALS_NOT_FOUND
  )
}

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
