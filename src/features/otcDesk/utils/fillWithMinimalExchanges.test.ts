import { describe, expect, it } from "vitest"
import {
  type FillResult,
  fillWithMinimalExchanges,
} from "./fillWithMinimalExchanges"
import type { TokenBalances } from "./fillWithMinimalExchanges"

describe("fillWithMinimalExchanges", () => {
  it("handles direct fills without exchanges", () => {
    const balances: TokenBalances = {
      A: 1000n,
      B: 500n,
      C: 200n,
    }
    const required: TokenBalances = {
      A: 500n,
      B: 300n,
    }
    const result = fillWithMinimalExchanges(balances, required, 30n)

    expect(result.success).toBe(true)
    fillInvariant(balances, required, result)

    expect(result).toEqual({
      success: true,
      remainingBalances: {
        A: 500n,
        B: 200n,
        C: 200n,
      },
      steps: expect.arrayContaining([
        {
          fromToken: "A",
          toToken: "A",
          fromAmount: 500n,
          toAmount: 500n,
          fee: 0n,
        },
        {
          fromToken: "B",
          toToken: "B",
          fromAmount: 300n,
          toAmount: 300n,
          fee: 0n,
        },
      ]),
    })
  })

  it("performs single exchange when needed", () => {
    const balances = {
      A: 1000n,
      B: 50n,
      C: 200n,
    }
    const required = {
      A: 500n,
      B: 100n,
    }

    const result = fillWithMinimalExchanges(balances, required, 30n)

    expect(result.success).toBe(true)
    fillInvariant(balances, required, result)

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        remainingBalances: {
          A: 449n,
          B: 0n,
          C: 200n,
        },
      })
    )
  })

  it("fails when insufficient balance for exchange", () => {
    const balances: TokenBalances = {
      A: 100n,
      B: 50n,
    }
    const required: TokenBalances = {
      A: 200n,
    }
    const result = fillWithMinimalExchanges(balances, required, 30n)

    expect(result.success).toBe(false)
  })

  it("handles multiple exchanges optimally", () => {
    const balances: TokenBalances = {
      A: 1000n,
      B: 10n,
      C: 10n,
      D: 1000n,
    }
    const required: TokenBalances = {
      B: 100n,
      C: 100n,
    }
    const result = fillWithMinimalExchanges(balances, required, 30n)

    expect(result.success).toBe(true)
    fillInvariant(balances, required, result)

    expect(result.steps).toMatchInlineSnapshot(`
      [
        {
          "fee": 0n,
          "fromAmount": 10n,
          "fromToken": "B",
          "toAmount": 10n,
          "toToken": "B",
        },
        {
          "fee": 1n,
          "fromAmount": 91n,
          "fromToken": "A",
          "toAmount": 90n,
          "toToken": "B",
        },
        {
          "fee": 0n,
          "fromAmount": 10n,
          "fromToken": "C",
          "toAmount": 10n,
          "toToken": "C",
        },
        {
          "fee": 1n,
          "fromAmount": 91n,
          "fromToken": "A",
          "toAmount": 90n,
          "toToken": "C",
        },
      ]
    `)
  })

  it("prefers using existing balances over exchanges", () => {
    const balances: TokenBalances = {
      A: 1000n,
      B: 50n,
      C: 200n,
    }
    const required: TokenBalances = {
      A: 500n,
      B: 45n, // Less than available balance
      C: 150n,
    }
    const result = fillWithMinimalExchanges(balances, required, 30n)

    expect(result.success).toBe(true)
    fillInvariant(balances, required, result)

    const bExchanges = result.steps.filter((step) => step.toToken === "B")
    expect(bExchanges).toHaveLength(1)
    expect(bExchanges[0]).toEqual(expect.objectContaining({ fee: 0n }))
  })

  it("handles edge case of empty balances", () => {
    const balances: TokenBalances = {}
    const required: TokenBalances = {
      A: 100n,
    }
    const result = fillWithMinimalExchanges(balances, required, 30n)

    expect(result.success).toBe(false)
  })

  it("handles edge case of empty requirements", () => {
    const balances: TokenBalances = {
      A: 100n,
    }
    const required: TokenBalances = {}
    const result = fillWithMinimalExchanges(balances, required, 30n)

    expect(result.success).toBe(true)
    fillInvariant(balances, required, result)

    expect(result.steps).toHaveLength(0)
    expect(result.remainingBalances).toEqual(balances)
  })

  it("verifies fee calculation in exchanges", () => {
    const balances: TokenBalances = {
      A: 500000n,
      B: 0n,
    }
    const required: TokenBalances = {
      B: 250000n,
    }
    const result = fillWithMinimalExchanges(balances, required, 30n)

    expect(result.success).toBe(true)
    fillInvariant(balances, required, result)

    expect(result.steps).toEqual([
      {
        fromToken: "A",
        toToken: "B",
        fromAmount: 250008n,
        toAmount: 250000n,
        fee: 8n,
      },
    ])
  })

  it("handles high fee scenarios", () => {
    const balances: TokenBalances = {
      A: 1000n,
      B: 0n,
    }
    const required: TokenBalances = {
      B: 100n,
    }
    const result = fillWithMinimalExchanges(balances, required, 50000n) // 5% fee

    expect(result.success).toBe(true)
    fillInvariant(balances, required, result)

    expect(result.steps).toEqual([
      {
        fromToken: "A",
        toToken: "B",
        fromAmount: 106n,
        toAmount: 100n,
        fee: 6n,
      },
    ])
  })

  it("preserves original balances object", () => {
    const balances: TokenBalances = {
      A: 1000n,
      B: 500n,
    }
    const originalBalances = { ...balances }
    const required: TokenBalances = {
      A: 300n,
    }

    fillWithMinimalExchanges(balances, required, 30n)
    expect(balances).toEqual(originalBalances)
  })

  it("handles zero fee", () => {
    const balances = {
      A: 400000n,
      B: 300000n,
      C: 0n,
    }
    const required = {
      C: 700000n,
    }

    const result = fillWithMinimalExchanges(balances, required, 0n)

    expect(result.success).toBe(true)
    fillInvariant(balances, required, result)

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        remainingBalances: {
          A: 0n,
          B: 0n,
          C: 0n,
        },
      })
    )
  })

  it("splits into 3 different tokens", () => {
    const balances = {
      A: 1000n,
      B: 1000n,
      C: 1000n,
    }
    const required = {
      A: 2000n,
    }

    const result = fillWithMinimalExchanges(balances, required, 1n)

    expect(result.success).toBe(true)
    fillInvariant(balances, required, result)
  })
})

function fillInvariant(
  balances: TokenBalances,
  required: TokenBalances,
  result: FillResult
) {
  let totalIn = 0n
  let totalOut = 0n
  for (const step of result.steps) {
    totalIn += step.fromAmount
    totalOut += step.toAmount
  }
  expect(totalOut).toEqual(sum(required))
  expect(sum(result.remainingBalances) + totalIn).toEqual(sum(balances))
}

function sum(balances: TokenBalances) {
  return Object.values(balances).reduce((acc, x) => acc + x, 0n)
}
