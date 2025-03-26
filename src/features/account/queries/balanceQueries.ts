import type { QueryObserverOptions } from "@tanstack/react-query"
import { nearClient } from "../../../constants/nearClient"
import {
  getDepositedBalances,
  getTransitBalances,
} from "../../../services/defuseBalanceService"
import { assert } from "../../../utils/assert"
import type { DefuseUserId } from "../../../utils/defuse"
import type { BalanceMapping } from "../../machines/depositedBalanceMachine"

export function createDepositedBalanceQueryOptions({
  userId,
  tokenIds,
}: { userId: null | DefuseUserId; tokenIds: string[] }) {
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
    [string, { userId: null | DefuseUserId; tokenIds: string[] }]
  >
}

export function createTransitBalanceQueryOptions({
  userId,
  tokenIds,
}: { userId: null | DefuseUserId; tokenIds: string[] }) {
  return {
    queryKey: ["intents_sdk.transit_balance", { userId, tokenIds }],
    queryFn: ({ queryKey }) => {
      assert(queryKey[1].userId != null)
      return getTransitBalances(queryKey[1].userId, queryKey[1].tokenIds)
    },
    enabled: (query) => query.queryKey[1].userId != null,
    refetchInterval: 10000,
  } satisfies QueryObserverOptions<
    BalanceMapping,
    Error,
    BalanceMapping,
    BalanceMapping,
    [string, { userId: null | DefuseUserId; tokenIds: string[] }]
  >
}
