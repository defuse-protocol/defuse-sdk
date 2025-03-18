import { beforeEach, describe, expect, it, vi } from "vitest"
import { tripleStorage } from "./giftMakerHistory"
import { indexedDBStorage } from "./indexedDBStorage"
import { localStorageHandler } from "./localStorageHandler"
import { sessionStorageHandler } from "./sessionStorageHandler"

describe("tripleStorage", () => {
  const mockData = JSON.stringify({ userId: "testUser", gifts: [] })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should get data from sessionStorage if localStorage is empty", async () => {
    vi.spyOn(localStorageHandler, "getItem").mockReturnValue(null)
    vi.spyOn(sessionStorageHandler, "getItem").mockReturnValue(mockData)
    vi.spyOn(indexedDBStorage, "getItem").mockResolvedValue(null)

    const result = await tripleStorage.getItem("testKey")
    expect(result).toEqual(JSON.parse(mockData))
  })

  it("should get data from indexedDBStorage if both localStorage and sessionStorage are empty", async () => {
    vi.spyOn(localStorageHandler, "getItem").mockReturnValue(null)
    vi.spyOn(sessionStorageHandler, "getItem").mockReturnValue(null)
    vi.spyOn(indexedDBStorage, "getItem").mockResolvedValue(mockData)

    const result = await tripleStorage.getItem("testKey")
    expect(result).toEqual(JSON.parse(mockData))
  })
})
