import { providers } from "near-api-js"
import type { FailoverRpcProvider } from "near-api-js/lib/providers"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createFailoverRpcProvider, failover } from "./failover"

const unstableRpcProvider = {
  startTime: Date.now(),
  status: vi.fn(() => {
    if (Date.now() - unstableRpcProvider.startTime > 500) {
      throw new Error("rpc down")
    }
    return { status: 200, result: "ok", id: 1 }
  }),
}

const stableRpcProvider = {
  status: vi.fn(() => {
    return { status: 200, result: "ok", id: 2 }
  }),
}

const jsonProviders = [
  Object.setPrototypeOf(
    unstableRpcProvider,
    providers.JsonRpcProvider.prototype
  ),
  Object.setPrototypeOf(stableRpcProvider, providers.JsonRpcProvider.prototype),
]

describe("createFailoverRpcProvider", () => {
  let nearClient: FailoverRpcProvider

  beforeEach(() => {
    nearClient = createFailoverRpcProvider({ providers: jsonProviders })
    vi.spyOn(nearClient, "status")
  })

  it("should return the status of the first provider when it is operational", async () => {
    const response = unstableRpcProvider.status()
    expect(response.status).toBe(200)
    expect(await nearClient.status()).toStrictEqual(response)
  })

  it("should switch to the second provider after 500ms if the first provider becomes unresponsive", async () => {
    const response = stableRpcProvider.status()
    vi.useFakeTimers()
    vi.advanceTimersByTime(500)

    // Suppress error output
    console.error = vi.fn()

    expect(await nearClient.status()).toStrictEqual(response)
    vi.useRealTimers()
  })
})

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
