import { describe, expect, it } from "vitest"
import { grossUpAmount, netDownAmount } from "./otcMakerBreakdown"

describe("netDownAmount", () => {
  it("throws error for invalid feeBip", () => {
    expect(() => netDownAmount({ amount: 100000n, decimals: 6 }, -1)).toThrow(
      "Invalid feeBip value. It must be between 0 and 10000."
    )
    expect(() =>
      netDownAmount({ amount: 100000n, decimals: 6 }, 10001)
    ).toThrow("Invalid feeBip value. It must be between 0 and 10000.")
  })

  /**
   * 1 bip = 0.01% = 0.0001
   * 30 bips = 0.3% = 0.003
   * 10000 bips = 100% = 1
   */
  it.each([
    [100300n, 30, 99999n],
    [100000n, 30, 99700n],
    [100000n, 0, 100000n],
    [100000n, 10000, 0n],
    [10002n, 1, 10000n],
    [10001n, 1, 9999n],
    [10000n, 1, 9999n],
    [1000n, 1, 999n],
    [100n, 1, 99n],
    [2n, 1, 1n],
    [1n, 1, 0n],
    [0n, 1, 0n],
  ])("reduce amount by fee", (amount, fee, expected) => {
    expect(netDownAmount({ amount, decimals: 6 }, fee)).toEqual({
      amount: expected,
      decimals: 6,
    })
  })
})

describe("grossUpAmount", () => {
  it("throws error for invalid feeBip", () => {
    expect(() => grossUpAmount({ amount: 100000n, decimals: 6 }, -1)).toThrow(
      "Invalid feeBip value. It must be between 0 and 10000."
    )
    expect(() =>
      grossUpAmount({ amount: 100000n, decimals: 6 }, 10001)
    ).toThrow("Invalid feeBip value. It must be between 0 and 10000.")
  })

  /**
   * 1 bip = 0.01% = 0.0001
   * 30 bips = 0.3% = 0.003
   * 10000 bips = 100% = 1
   */
  it.each([
    [99999n, 30, 100300n],
    [99700n, 30, 100000n],
    [100000n, 0, 100000n],
    [10000n, 1, 10002n],
    [9999n, 1, 10000n],
    [999n, 1, 1000n],
    [99n, 1, 100n],
    [1n, 1, 2n],
    [0n, 1, 0n],
  ])(
    "calculate gross amount needed for desired net amount after fee",
    (targetAmount, fee, expectedGross) => {
      expect(grossUpAmount({ amount: targetAmount, decimals: 6 }, fee)).toEqual(
        {
          amount: expectedGross,
          decimals: 6,
        }
      )
    }
  )
})
