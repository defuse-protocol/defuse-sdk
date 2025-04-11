import type { QueryObserverOptions } from "@tanstack/react-query"
import { nearClient } from "../../../constants/nearClient"
import {
  getDepositedBalances,
  getPendingDeposits,
} from "../../../services/defuseBalanceService"
import type { IntentsUserId } from "../../../types/intentsUserId"
import { assert } from "../../../utils/assert"
import type { BalanceMapping } from "../../machines/depositedBalanceMachine"

export function createDepositedBalanceQueryOptions({
  userId,
  tokenIds,
}: { userId: null | IntentsUserId; tokenIds: string[] }) {
  return {
    queryKey: ["intents_sdk.deposited_balance", { userId, tokenIds }],
    queryFn: async ({ queryKey }) => {
      assert(queryKey[1].userId != null)

      return getDepositedBalances(
        queryKey[1].userId,
        queryKey[1].tokenIds,
        nearClient
      )
    },
    enabled: (query) => query.queryKey[1].userId != null,
    refetchInterval: 10000,
  } satisfies QueryObserverOptions<
    BalanceMapping,
    Error,
    BalanceMapping,
    BalanceMapping,
    [string, { userId: null | IntentsUserId; tokenIds: string[] }]
  >
}

export function createTransitBalanceQueryOptions({
  userId,
  tokenIds,
}: { userId: null | IntentsUserId; tokenIds: string[] }) {
  return {
    queryKey: ["intents_sdk.transit_balance", { userId, tokenIds }],
    queryFn: ({ queryKey }) => {
      assert(queryKey[1].userId != null)
      return getPendingDeposits(queryKey[1].userId, queryKey[1].tokenIds)
    },
    enabled: (query) => query.queryKey[1].userId != null,
    refetchInterval: 10000,
  } satisfies QueryObserverOptions<
    BalanceMapping,
    Error,
    BalanceMapping,
    BalanceMapping,
    [string, { userId: null | IntentsUserId; tokenIds: string[] }]
  >
}
