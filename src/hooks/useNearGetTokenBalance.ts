import { useMutation, useQuery } from "@tanstack/react-query"
import {
  getNearBalances,
  getNearNativeBalance,
  getNearNep141Balance,
} from "src/features/machines/getBalanceMachine"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../types/base"

const queryKey = "get-balance"

export const getGetNearNativeBalanceKey = [queryKey, "get-near-native-balance"]

export const useGetNearNativeBalance = (options = {}) =>
  useMutation({
    mutationKey: getGetNearNativeBalanceKey,
    mutationFn: (params: { userAddress: string }) =>
      getNearNativeBalance(params),
    ...options,
  })

export const getGetNearNep141BalanceAccountKey = [
  queryKey,
  "get-near-nep141-balance-account",
]

export const useGetNearNep141BalanceAccount = (options = {}) =>
  useMutation({
    mutationKey: getGetNearNep141BalanceAccountKey,
    mutationFn: (params: {
      tokenAddress: string
      userAddress: string
    }) => getNearNep141Balance(params),
    ...options,
  })

export const getNearBalancesKey = [queryKey, "get-near-balances"]

export const useGetNearBalances = (options = {}) =>
  useMutation({
    mutationKey: getNearBalancesKey,
    mutationFn: (params: {
      tokenList: Array<BaseTokenInfo | UnifiedTokenInfo>
      userAddress: string
    }) => getNearBalances(params),
    ...options,
    retry: 2,
  })
