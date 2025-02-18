import { beforeEach, describe, expect, it, vi } from "vitest"
import { failover } from "./failover"

describe("abstractFailover", () => {
  let service: (url: string) => Promise<number>

  beforeEach(() => {
    service = vi.fn(async (url: string) => {
      if (url.includes("failing")) {
        throw new Error("Server returned 500")
      }
      return 201
    })
  })

  it("should throw an error if no URLs are provided", async () => {
    await expect(failover([], service)).rejects.toThrow("All providers failed")
  })

  it("should throw an error if all URLs fail", async () => {
    const urls = ["https://failing-rpc-1", "https://failing-rpc-2"]
    await expect(failover(urls, service)).rejects.toThrow(
      "All providers failed"
    )
  })

  it("should return the result of a single successful provider", async () => {
    const urls = ["https://success-rpc-1"]
    const result = await failover(urls, service)
    expect(result).toBe(201)
  })

  it("should return the result of the first successful provider", async () => {
    const urls = ["https://success-rpc-1", "https://failing-rpc-1"]
    const result = await failover(urls, service)
    expect(result).toBe(201)
    expect(service).toHaveBeenCalledTimes(1)
  })

  it("should respect retry delay settings", async () => {
    const urls = ["https://failing-rpc-1", "https://success-rpc-1"]
    const start = Date.now()
    await failover(urls, service)
    const duration = Date.now() - start
    expect(duration).toBeGreaterThanOrEqual(500) // Ensure at least one retry delay
  })

  it("should switch to the next provider if the current one fails", async () => {
    const urls = ["https://failing-rpc-1", "https://success-rpc-1"]
    const result = await failover(urls, service)
    expect(result).toBe(201)
    expect(service).toHaveBeenCalledTimes(2)
  })
})
