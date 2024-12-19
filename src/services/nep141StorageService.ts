import type { BaseTokenInfo, UnifiedTokenInfo } from "src/types"
import { isFungibleToken } from "src/utils"
import {
  getNearNep141MinStorageBalance,
  getNearNep141StorageBalance,
} from "../features/machines/getBalanceMachine"

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
 * @param tokenAddress.
 * @param tokenChainName.
 * @param userAccountId The user's NEAR account ID.
 * @returns The amount of NEAR required for the user to store the token; 0 means no storage required.
 */
export async function getNEP141StorageRequired({
  token,
  userAccountId,
}: {
  token: BaseTokenInfo | UnifiedTokenInfo
  userAccountId: string
}): Promise<Output> {
  if (!isFungibleToken(token) || token.chainName !== "near")
    return { tag: "ok", value: 0n }
  // No storage deposit is required for having ETH in near blockchain. (P.S. aurora is ETH address on Near network)
  if (token.address === "aurora") {
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
