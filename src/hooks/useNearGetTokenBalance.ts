import { useMutation, useQuery } from "@tanstack/react-query"
import {
  getNearNativeBalance,
  getNearNep141Balance,
  getNearNep141Balances,
} from "src/features/machines/getBalanceMachine"
import { getNearNep141BalanceAccount } from "src/services/nearHttpClient"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../types/base"

const queryKey = "get-balance"

export const getGetNearNativeBalanceKey = [queryKey, "get-near-native-balance"]

export const useGetNearNativeBalance = (
  params: { accountId: string },
  options = {}
) =>
  useQuery({
    queryKey: getGetNearNativeBalanceKey,
    queryFn: () => getNearNativeBalance(params),
    ...options,
  })

export const getGetNearNep141BalanceAccountKey = [
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
    queryKey: getGetNearNep141BalanceAccountKey,
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
