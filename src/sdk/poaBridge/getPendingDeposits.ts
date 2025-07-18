import { poaBridge } from "@defuse-protocol/internal-utils"
import type { IntentsUserId } from "../../types/intentsUserId"

type PendingDeposit =
  poaBridge.httpClient.GetDepositStatusResponse["result"]["deposits"][number] & {
    status: "PENDING"
  }

export type GetPendingDepositsOkType = PendingDeposit[]

export type GetPendingDepositsErrorType = poaBridge.httpClient.JSONRPCErrorType

export async function getPendingDeposits(
  accountId: IntentsUserId
): Promise<GetPendingDepositsOkType> {
  const depositStatus = await poaBridge.httpClient.getDepositStatus({
    account_id: accountId,
  })

  return depositStatus.deposits.filter(
    (a): a is PendingDeposit => a.status === "PENDING"
  )
}
