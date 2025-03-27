import { queryOptions } from "@tanstack/react-query"
import { getWithdrawalStatus } from "../services/poaBridgeClient"

const DEFAULT_WITHDRAWAL_STATUS_INTERVAL_MS = 500

export function createWithdrawalStatusQueryOptions({
  txHash,
}: { txHash: string }) {
  return queryOptions({
    queryKey: ["intents_sdk.withdrawal_status", txHash],
    queryFn: () => getWithdrawalStatus({ withdrawal_hash: txHash }),
    retry: true,
    retryDelay: DEFAULT_WITHDRAWAL_STATUS_INTERVAL_MS,
    staleTime: DEFAULT_WITHDRAWAL_STATUS_INTERVAL_MS,
    refetchInterval: (query) => {
      if (query.state.data == null) {
        return DEFAULT_WITHDRAWAL_STATUS_INTERVAL_MS
      }

      const withdrawal = query.state.data.withdrawals[0]
      if (withdrawal == null || withdrawal.status !== "COMPLETED") {
        return DEFAULT_WITHDRAWAL_STATUS_INTERVAL_MS
      }

      return false
    },
  })
}
