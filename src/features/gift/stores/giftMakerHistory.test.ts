import { beforeEach, describe, expect, it, vi } from "vitest"
import { logger } from "../../../logger"
import type { DefuseUserId } from "../../../utils/defuse"
import {
  type GiftData,
  deserializeGiftData,
  serializeGiftData,
} from "../utils/giftDataSerializer"
import { type GiftMakerHistory, tripleStorage } from "./giftMakerHistory"
import { indexedDBStorage } from "./indexedDBStorage"
import { localStorageHandler } from "./localStorageHandler"
import { sessionStorageHandler } from "./sessionStorageHandler"

describe("tripleStorage", () => {
  const mockData = JSON.stringify({
    state: { gifts: {} as Record<DefuseUserId, GiftMakerHistory[]> },
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should get data from sessionStorage if localStorage is empty", async () => {
    vi.spyOn(localStorageHandler, "getItem").mockReturnValue(null)
    vi.spyOn(sessionStorageHandler, "getItem").mockReturnValue(mockData)
    vi.spyOn(indexedDBStorage, "getItem").mockResolvedValue(null)

    const result = await tripleStorage.getItem("testKey")
    expect(result).toEqual({ state: { gifts: {} } })
  })

  it("should get data from indexedDBStorage if both localStorage and sessionStorage are empty", async () => {
    vi.spyOn(localStorageHandler, "getItem").mockReturnValue(null)
    vi.spyOn(sessionStorageHandler, "getItem").mockReturnValue(null)
    vi.spyOn(indexedDBStorage, "getItem").mockResolvedValue(mockData)

    const result = await tripleStorage.getItem("testKey")
    expect(result).toEqual({ state: { gifts: {} } })
  })

  it("should get data from localStorage even if an error occurs in indexedDBStorage", async () => {
    const errorSpy = vi.spyOn(logger, "error")
    const mockGiftData = { state: { gifts: {} } }
    const serializedData = JSON.stringify(
      serializeGiftData(mockGiftData as GiftData)
    )

    vi.spyOn(localStorageHandler, "getItem").mockReturnValue(serializedData)
    vi.spyOn(sessionStorageHandler, "getItem").mockImplementation(() => {
      throw new Error("Session storage error")
    })
    const indexedDBError = new Error("IndexedDB error")
    vi.spyOn(indexedDBStorage, "getItem").mockRejectedValue(indexedDBError)

    const result = await tripleStorage.getItem("testKey")

    expect(result).toEqual(mockGiftData)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cause: expect.any(Error),
        message: "Failed to fetch from sessionStorage",
      })
    )
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cause: indexedDBError,
        message: "Failed to fetch from indexedDB",
      })
    )
  })

  it("should set data in localStorage and sessionStorage even if an error occurs in indexedDBStorage", async () => {
    const mockData = {
      state: { gifts: {} as Record<DefuseUserId, GiftMakerHistory[]> },
    }
    const stringifiedData = JSON.stringify(mockData)

    vi.spyOn(localStorageHandler, "setItem").mockImplementation(() => {})
    vi.spyOn(sessionStorageHandler, "setItem").mockImplementation(() => {})
    vi.spyOn(indexedDBStorage, "setItem").mockRejectedValue(
      new Error("IndexedDB error")
    )

    await tripleStorage.setItem("testKey", mockData)
    expect(localStorageHandler.setItem).toHaveBeenCalledWith(
      "testKey",
      stringifiedData
    )
    expect(sessionStorageHandler.setItem).toHaveBeenCalledWith(
      "testKey",
      stringifiedData
    )
  })
})

describe("processGiftData", () => {
  const mockGift: GiftMakerHistory = {
    accountId: "accountId",
    giftId: "giftId",
    intentHashes: ["intentHash"],
    message: "message",
    secretKey: "ed25519:secretKey",
    token: {
      unifiedAssetId: "usdc",
      decimals: 6,
      symbol: "USDC",
      name: "USD Coin",
      icon: "icon",
      groupedTokens: [],
    },
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
    const result = serializeGiftData(mockStorageData)
    expect(result).toMatchInlineSnapshot(`
      {
        "state": {
          "gifts": {
            "testUser": [
              {
                "accountId": "accountId",
                "giftId": "giftId",
                "intentHashes": [
                  "intentHash",
                ],
                "message": "message",
                "secretKey": "ed25519:secretKey",
                "token": {
                  "decimals": 6,
                  "groupedTokens": [],
                  "icon": "icon",
                  "name": "USD Coin",
                  "symbol": "USDC",
                  "unifiedAssetId": "usdc",
                },
                "tokenDiff": {
                  "nep141:usdc": "1000",
                },
                "updatedAt": 1742910077547,
              },
            ],
          },
        },
      }
    `)
  })

  it("should deserialize correct storage data", () => {
    const serialized = serializeGiftData(mockStorageData)
    const result = deserializeGiftData(serialized as unknown as GiftData)
    expect(result).toEqual(mockStorageData)
  })
})
