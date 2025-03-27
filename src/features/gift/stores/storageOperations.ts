import type { SignerCredentials } from "../../../core/formatters"
import { logger } from "../../../logger"
import type { DefuseUserId } from "../../../utils/defuse"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import { deserialize } from "../../../utils/deserialize"
import { serialize } from "../../../utils/serialize"
import type { GiftStorageState, State } from "./giftMakerHistory"
import { indexedDBStorage } from "./indexedDBStorage"
import { localStorageHandler } from "./localStorageHandler"
import { sessionStorageHandler } from "./sessionStorageHandler"

type StorageOperationType = "fetch" | "set" | "update" | "remove"

export type StorageOperation<T> = {
  operation: () => T | Promise<T>
  storageName: string
  operationType: StorageOperationType
}

type ExecuteStorageOperationsOk<T> = { tag: "ok"; result: T }
type ExecuteStorageOperationsErr = { tag: "err"; reason: StorageOperationErr }

export type StorageOperationErr =
  | "ERR_GET_ITEM_FAILED_IN_ALL_STORES"
  | "ERR_SET_ITEM_FAILED_IN_ALL_STORES"
  | "ERR_UPDATE_ITEM_FAILED_IN_ALL_STORES"
  | "ERR_REMOVE_ITEM_FAILED_IN_ALL_STORES"
  | "ERR_STORAGE_OPERATION_EXCEPTION"
  | "ERR_STORAGE_DATA_INVALID"
  | "ERR_STORAGE_DATA_DESERIALIZATION_FAILED"
export type StorageOperationResult =
  | { tag: "ok" }
  | {
      tag: "err"
      reason: StorageOperationErr
    }

const countStores = 3

export async function executeStorageOperations<T>(
  operations: StorageOperation<T>[]
): Promise<ExecuteStorageOperationsOk<T> | ExecuteStorageOperationsErr> {
  const results = await Promise.all(
    operations.map(async ({ operation, storageName, operationType }) => {
      try {
        const result = await operation()
        return { tag: "ok", result, operationType } as const
      } catch (error) {
        logger.error(
          new Error(`Failed to ${operationType} at ${storageName}`, {
            cause: error,
          })
        )
        return { tag: "err", operationType } as const
      }
    })
  )

  const failedOperations = results.filter((r) => r.tag === "err")
  if (failedOperations.length === countStores) {
    const firstFailed = failedOperations[0]
    if (!firstFailed) {
      return { tag: "err", reason: "ERR_STORAGE_OPERATION_EXCEPTION" }
    }
    let reason: StorageOperationErr
    switch (firstFailed.operationType) {
      case "fetch":
        reason = "ERR_GET_ITEM_FAILED_IN_ALL_STORES"
        break
      case "set":
        reason = "ERR_SET_ITEM_FAILED_IN_ALL_STORES"
        break
      case "update":
        reason = "ERR_UPDATE_ITEM_FAILED_IN_ALL_STORES"
        break
      case "remove":
        reason = "ERR_REMOVE_ITEM_FAILED_IN_ALL_STORES"
        break
      default:
        reason = "ERR_STORAGE_OPERATION_EXCEPTION"
    }
    return { tag: "err", reason }
  }

  const successfulOperations = results.filter((r) => r.tag === "ok")

  const firstSuccess = successfulOperations[0]

  if (
    !firstSuccess ||
    (firstSuccess?.operationType === "fetch" &&
      firstSuccess.result === undefined)
  ) {
    return { tag: "err", reason: "ERR_STORAGE_OPERATION_EXCEPTION" }
  }

  return {
    tag: "ok",
    result: firstSuccess.result as T,
  }
}

export const tripleStorage = {
  getItem: async (
    name: string
  ): Promise<{ state: State; version: number } | null> => {
    const result = await executeStorageOperations([
      {
        operation: () => localStorageHandler.getItem(name),
        storageName: "localStorage",
        operationType: "fetch",
      },
      {
        operation: () => sessionStorageHandler.getItem(name),
        storageName: "sessionStorage",
        operationType: "fetch",
      },
      {
        operation: () => indexedDBStorage.getItem(name),
        storageName: "indexedDB",
        operationType: "fetch",
      },
    ])

    if (result.tag === "err") {
      throw new Error("Failed to get item from all stores")
    }

    const rawData = result.result
    if (!rawData) return null

    try {
      return deserialize(rawData) as { state: State; version: number }
    } catch (error) {
      logger.error(new Error("Failed to deserialize data", { cause: error }))
      throw new Error("Failed to deserialize data")
    }
  },

  setItem: async (
    name: string,
    value: GiftStorageState
  ): Promise<StorageOperationResult> => {
    const stringValue = serialize(value)
    const result = await executeStorageOperations([
      {
        operation: () => localStorageHandler.setItem(name, stringValue),
        storageName: "localStorage",
        operationType: "set",
      },
      {
        operation: () => sessionStorageHandler.setItem(name, stringValue),
        storageName: "sessionStorage",
        operationType: "set",
      },
      {
        operation: () => indexedDBStorage.setItem(name, stringValue),
        storageName: "indexedDB",
        operationType: "set",
      },
    ])

    if (result.tag === "err") {
      return result
    }
    return { tag: "ok" }
  },

  updateItem: async (
    name: string,
    value: GiftStorageState
  ): Promise<StorageOperationResult> => {
    const stringValue = serialize(value)
    const result = await executeStorageOperations([
      {
        operation: () => localStorageHandler.setItem(name, stringValue),
        storageName: "localStorage",
        operationType: "update",
      },
      {
        operation: () => sessionStorageHandler.setItem(name, stringValue),
        storageName: "sessionStorage",
        operationType: "update",
      },
      {
        operation: () => indexedDBStorage.setItem(name, stringValue),
        storageName: "indexedDB",
        operationType: "update",
      },
    ])

    if (result.tag === "err") {
      return result
    }
    return { tag: "ok" }
  },

  removeItem: async (name: string): Promise<StorageOperationResult> => {
    const result = await executeStorageOperations([
      {
        operation: () => localStorageHandler.removeItem(name),
        storageName: "localStorage",
        operationType: "remove",
      },
      {
        operation: () => sessionStorageHandler.removeItem(name),
        storageName: "sessionStorage",
        operationType: "remove",
      },
      {
        operation: () => indexedDBStorage.removeItem(name),
        storageName: "indexedDB",
        operationType: "remove",
      },
    ])

    if (result.tag === "err") {
      return result
    }
    return { tag: "ok" }
  },
}

export function getUserId(
  user: DefuseUserId | SignerCredentials
): DefuseUserId {
  return typeof user === "string"
    ? user
    : userAddressToDefuseUserId(user.credential, user.credentialType)
}
