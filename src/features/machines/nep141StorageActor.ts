import { fromPromise } from "xstate"
import type { BaseTokenInfo } from "../../types/base"
import { isNativeToken } from "../../utils"
import {
  getNearNep141MinStorageBalance,
  getNearNep141StorageBalance,
} from "./getBalanceMachine"

export type Output =
  | {
      result: "OK" | "ERR_NEP141_STORAGE_CANNOT_FETCH"
    }
  | {
      result: "NEED_NEP141_STORAGE"
      amount: bigint
    }

export const nep141StorageActor = fromPromise(
  async ({
    input,
  }: {
    input: {
      token: BaseTokenInfo
      userAccountId: string
    }
  }): Promise<Output> => {
    if (input.token.chainName !== "near" || isNativeToken(input.token)) {
      return { result: "OK" }
    }

    const [minStorageBalanceResult, userStorageBalanceResult] =
      await Promise.allSettled([
        getNearNep141MinStorageBalance({
          contractId: input.token.address,
        }),
        getNearNep141StorageBalance({
          contractId: input.token.address,
          accountId: input.userAccountId,
        }),
      ])

    if (minStorageBalanceResult.status === "rejected") {
      console.error(new Error(minStorageBalanceResult.reason))
      return {
        result: "ERR_NEP141_STORAGE_CANNOT_FETCH",
      }
    }

    if (userStorageBalanceResult.status === "rejected") {
      console.error(userStorageBalanceResult.reason)
      return {
        result: "ERR_NEP141_STORAGE_CANNOT_FETCH",
      }
    }

    const minStorageBalance = minStorageBalanceResult.value
    const userStorageBalance = userStorageBalanceResult.value

    if (userStorageBalance < minStorageBalance) {
      return {
        result: "NEED_NEP141_STORAGE",
        amount: minStorageBalance,
      }
    }

    return {
      result: "OK",
    }
  }
)
