import { describe, expect, it } from "vitest"
import { adjustTo1kUsd } from "./utils"

describe("adjustTo1kUsd", () => {
  it("calculates the correct adjusted value when amount is small", () => {
    const tokenValue = {
      amount: 2500000000000000000n,
      decimals: 18,
      price: 100, // USD
    }

    const result = adjustTo1kUsd(tokenValue)

    // (2.5 * 100) / 1000 = 0.25 => Math.ceil(0.25) = 1
    expect(result).toBe(1)
  })

  it("calculates the correct adjusted value when amount is large", () => {
    const tokenValue = {
      amount: 1200000000000000000000n,
      decimals: 18,
      price: 2, // USD
    }

    const result = adjustTo1kUsd(tokenValue)

    // (1200 * 2) / 1000 = 2.4 => Math.ceil(2.4) = 2
    expect(result).toBe(2)
  })

  it("returns 0 if the calculated amount is 0", () => {
    const tokenValue = {
      amount: 0n,
      decimals: 18,
      price: 500,
    }

    const result = adjustTo1kUsd(tokenValue)

    // (0 * 500) / 1000 = 0 => Math.ceil(0) = 0
    expect(result).toBe(0)
  })

  it("handles fractional prices properly", () => {
    const tokenValue = {
      amount: 1500000000000000000n,
      decimals: 18,
      price: 33.33,
    }

    const result = adjustTo1kUsd(tokenValue)

    // (1.5 * 33.33) / 1000 ≈ 0.049995 => Math.ceil(0.049995) = 1
    expect(result).toBe(1)
  })

  it("handles when formatUnits returns integer string", () => {
    const tokenValue = {
      amount: 1000000000000000000000n,
      decimals: 18,
      price: 1,
    }

    const result = adjustTo1kUsd(tokenValue)

    // (1000 * 1) / 1000 = 1 => Math.ceil(1) = 1
    expect(result).toBe(1)
  })
})
