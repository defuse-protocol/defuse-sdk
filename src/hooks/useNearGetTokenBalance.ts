import { useQuery } from "@tanstack/react-query"
import {
  getNearNativeBalance,
  getNearNep141Balance,
  getNearNep141Balances,
} from "../features/machines/getBalanceMachine"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../types/base"

const queryKey = "get-balance"

export const getNearNativeBalanceKey = [queryKey, "get-near-native-balance"]

export const useGetNearNativeBalance = (
  params: { accountId: string },
  options = {}
) =>
  useQuery({
    queryKey: getNearNativeBalanceKey,
    queryFn: () => getNearNativeBalance(params),
    ...options,
  })

export const getNearNep141BalanceAccountKey = [
  queryKey,
  "get-near-nep141-balance",
]

export const useGetNearNep141Balance = (
  params: {
    tokenAddress: string
    accountId: string
  },
  options = {}
) =>
  useQuery({
    queryKey: getNearNep141BalanceAccountKey,
    queryFn: () => getNearNep141Balance(params),
    ...options,
  })

export const getNearBalancesKey = [queryKey, "get-near-nep141-balances"]

export const useGetNearNep141Balances = (
  params: {
    tokenList: Array<BaseTokenInfo | UnifiedTokenInfo>
    accountId: string
  },
  options = {}
) =>
  useQuery({
    queryKey: getNearBalancesKey,
    queryFn: () => getNearNep141Balances(params),
    ...options,
  })
