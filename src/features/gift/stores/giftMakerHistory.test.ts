import { deserialize } from "src/utils/deserialize"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { logger } from "../../../logger"
import { serialize } from "../../../utils/serialize"
import type { GiftMakerHistory } from "./giftMakerHistory"
import { indexedDBStorage } from "./indexedDBStorage"
import { localStorageHandler } from "./localStorageHandler"
import { sessionStorageHandler } from "./sessionStorageHandler"
import { tripleStorage } from "./storageOperations"

describe("tripleStorage", () => {
  const mockStorageData = {
    state: {
      gifts: {
        alice: [
          {
            giftId: "YjUjyafLoHZGVB4JeG1y85sJKjxeTMCvqCDRifsPFb8=",
            giftStatus: "preparing",
            intentHashes: ["Amy7ek15DBZZhQB7DHynCUxKGTYZJCmawNK841RvS69Q"],
            tokenDiff: {
              "nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near":
                100n,
            },
            tokenId: "usdc",
            secretKey: "ed25519:mWCSdwW",
            accountId: "accountId",
            message: "",
            updatedAt: 1743010969229,
          },
        ],
      },
    },
    version: 2,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should get data from sessionStorage if localStorage is empty", async () => {
    vi.spyOn(localStorageHandler, "getItem").mockReturnValue(null)
    vi.spyOn(sessionStorageHandler, "getItem").mockReturnValue(
      serialize(mockStorageData)
    )
    vi.spyOn(indexedDBStorage, "getItem").mockResolvedValue(null)

    const result = await tripleStorage.getItem("alice")
    expect(result).toEqual(deserialize(serialize(mockStorageData)))
  })

  it("should get data from indexedDBStorage if both localStorage and sessionStorage are empty", async () => {
    vi.spyOn(localStorageHandler, "getItem").mockReturnValue(null)
    vi.spyOn(sessionStorageHandler, "getItem").mockReturnValue(null)
    vi.spyOn(indexedDBStorage, "getItem").mockResolvedValue(
      serialize(mockStorageData)
    )

    const result = await tripleStorage.getItem("alice")
    expect(result).toEqual(deserialize(serialize(mockStorageData)))
  })

  it("should get data from localStorage even if an error occurs in indexedDBStorage", async () => {
    const errorSpy = vi.spyOn(logger, "error")

    vi.spyOn(localStorageHandler, "getItem").mockReturnValue(
      serialize(mockStorageData)
    )
    vi.spyOn(sessionStorageHandler, "getItem").mockImplementation(() => {
      throw new Error("Session storage error")
    })
    const indexedDBError = new Error("IndexedDB error")
    vi.spyOn(indexedDBStorage, "getItem").mockRejectedValue(indexedDBError)

    const result = await tripleStorage.getItem("alice")

    expect(result).toEqual(deserialize(serialize(mockStorageData)))
    expect(errorSpy).toHaveBeenCalledWith(
      new Error("Failed to fetch at sessionStorage")
    )
    expect(errorSpy).toHaveBeenCalledWith(
      new Error("Failed to fetch at indexedDB")
    )
  })

  it("should set data in localStorage and sessionStorage even if an error occurs in indexedDBStorage", async () => {
    const errorSpy = vi.spyOn(logger, "error")

    vi.spyOn(localStorageHandler, "setItem").mockReturnValue(undefined)
    vi.spyOn(sessionStorageHandler, "setItem").mockReturnValue(undefined)
    vi.spyOn(indexedDBStorage, "setItem").mockRejectedValue(
      new Error("IndexedDB error")
    )

    await tripleStorage.setItem("alice", mockStorageData)

    expect(localStorageHandler.setItem).toHaveBeenCalledWith(
      "alice",
      serialize(mockStorageData)
    )
    expect(sessionStorageHandler.setItem).toHaveBeenCalledWith(
      "alice",
      serialize(mockStorageData)
    )
    expect(errorSpy).toHaveBeenCalledWith(
      new Error("Failed to set at indexedDB")
    )
  })

  it("should return err if an error occurs in all storage operations", async () => {
    vi.spyOn(localStorageHandler, "setItem").mockImplementation(() => {
      throw new Error("test")
    })
    vi.spyOn(sessionStorageHandler, "setItem").mockImplementation(() => {
      throw new Error("test")
    })
    vi.spyOn(indexedDBStorage, "setItem").mockImplementation(() => {
      throw new Error("test")
    })

    const result = await tripleStorage.setItem("alice", mockStorageData)
    expect(result).toEqual({
      tag: "err",
      reason: "ERR_SET_ITEM_FAILED_IN_ALL_STORES",
    })
  })

  it("should return ok if all storage operations are successful", async () => {
    vi.spyOn(localStorageHandler, "setItem").mockImplementation(() => ({
      tag: "ok",
      result: undefined,
    }))
    vi.spyOn(sessionStorageHandler, "setItem").mockImplementation(() => ({
      tag: "ok",
      result: undefined,
    }))
    vi.spyOn(indexedDBStorage, "setItem").mockResolvedValue(undefined)

    const result = await tripleStorage.setItem("alice", mockStorageData)
    expect(result).toEqual({
      tag: "ok",
    })
  })
})

describe("processGiftData", () => {
  const mockGift: GiftMakerHistory = {
    accountId: "accountId",
    giftId: "giftId",
    intentHashes: ["intentHash"],
    message: "message",
    secretKey: "ed25519:secretKey",
    tokenId: "usdc",
    giftStatus: "preparing",
    tokenDiff: {
      "nep141:usdc": 1000n,
    },
    updatedAt: 1742910077547,
  }
  const mockUserId = "testUser"

  const mockStorageData = {
    state: {
      gifts: {
        [mockUserId]: [mockGift],
      },
    },
  }

  it("should serialize correct storage data", () => {
    const result = JSON.parse(serialize(mockStorageData))
    expect(result).toMatchInlineSnapshot(`
      {
        "state": {
          "gifts": {
            "testUser": [
              {
                "accountId": "accountId",
                "giftId": "giftId",
                "giftStatus": "preparing",
                "intentHashes": [
                  "intentHash",
                ],
                "message": "message",
                "secretKey": "ed25519:secretKey",
                "tokenDiff": {
                  "nep141:usdc": {
                    "__type": "bigint",
                    "value": "1000",
                  },
                },
                "tokenId": "usdc",
                "updatedAt": 1742910077547,
              },
            ],
          },
        },
      }
    `)
  })

  it("should deserialize correct storage data", () => {
    const result = deserialize(serialize(mockStorageData))
    expect(result).toEqual(mockStorageData)
  })
})
