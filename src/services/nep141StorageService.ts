import {
  getNearNep141MinStorageBalance,
  getNearNep141StorageBalance,
} from "../features/machines/getBalanceMachine"
import type { BaseTokenInfo } from "../types/base"
import { isNativeToken } from "../utils"

export type Output =
  | {
      tag: "ok"
      value: bigint
    }
  | {
      tag: "err"
      value: { reason: "ERR_NEP141_STORAGE_CANNOT_FETCH" }
    }

/**
 * Get the amount of NEP-141 storage required for the user to store the token.
 * @param token The token to check.
 * @param userAccountId The user's NEAR account ID.
 * @returns The amount of NEAR required for the user to store the token; 0 means no storage required.
 */
export async function getNEP141StorageRequired({
  token,
  userAccountId,
}: {
  token: BaseTokenInfo
  userAccountId: string
}): Promise<Output> {
  if (token.chainName !== "near" || isNativeToken(token)) {
    return { tag: "ok", value: 0n }
  }

  // For withdrawing ETH to NEAR no storage_deposit is required. (P.S. aurora is ETH address on Near network)
  if (token.chainName === "near" && token.address === "aurora") {
    return { tag: "ok", value: 0n }
  }

  const [minStorageBalanceResult, userStorageBalanceResult] =
    await Promise.allSettled([
      getNearNep141MinStorageBalance({
        contractId: token.address,
      }),
      getNearNep141StorageBalance({
        contractId: token.address,
        accountId: userAccountId,
      }),
    ])

  if (minStorageBalanceResult.status === "rejected") {
    console.error(minStorageBalanceResult.reason)
    return {
      tag: "err",
      value: { reason: "ERR_NEP141_STORAGE_CANNOT_FETCH" },
    }
  }

  if (userStorageBalanceResult.status === "rejected") {
    console.error(userStorageBalanceResult.reason)
    return {
      tag: "err",
      value: { reason: "ERR_NEP141_STORAGE_CANNOT_FETCH" },
    }
  }

  const minStorageBalance = minStorageBalanceResult.value
  const userStorageBalance = userStorageBalanceResult.value

  if (userStorageBalance < minStorageBalance) {
    return {
      tag: "ok",
      value: minStorageBalance - userStorageBalance,
    }
  }

  return {
    tag: "ok",
    value: 0n,
  }
}
