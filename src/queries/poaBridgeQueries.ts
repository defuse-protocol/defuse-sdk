import { queryOptions, useQuery } from "@tanstack/react-query"
import {
  getTokenBalancesRequest,
  getWithdrawalStatus,
} from "../sdk/poaBridge/poaBridgeHttpClient"
import type { SwappableToken } from "../types/swap"
import {
  filterOutPoaBridgeTokens,
  getTokenAccountIds,
} from "../utils/tokenUtils"

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

export function useTokenBalancesQuery(token: SwappableToken, enabled = true) {
  const onlyPoaTokens = filterOutPoaBridgeTokens(token)
  const addresses = getTokenAccountIds(onlyPoaTokens)

  return useQuery({
    queryKey: ["intents_sdk.token_balances", addresses.slice().sort()],
    queryFn: () => getTokenBalancesRequest(addresses),
    staleTime: 60 * 1000, // 1 min
    gcTime: 60 * 1000, // 1 min
    enabled: addresses.length > 0 && enabled,
  })
}
