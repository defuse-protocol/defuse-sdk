import { assert, afterEach, describe, expect, it, vi } from "vitest"
import type { BaseTokenInfo, TokenValue } from "../types/base"
import {
  adjustDecimals,
  computeTotalBalanceDifferentDecimals,
} from "../utils/tokenUtils"
import {
  AmountMismatchError,
  aggregateQuotes,
  calculateSplitAmounts,
  queryQuote,
} from "./quoteService"
import * as relayClient from "./solverRelayHttpClient"
import type { QuoteResponse } from "./solverRelayHttpClient/types"

vi.spyOn(relayClient, "quote")

const tokenInfo: BaseTokenInfo = {
  defuseAssetId: "",
  address: "",
  symbol: "",
  name: "",
  decimals: 0,
  icon: "",
  chainId: "",
  chainIcon: "",
  chainName: "eth",
  routes: [],
}

const token1 = {
  ...tokenInfo,
  defuseAssetId: "token1",
  decimals: 6,
}
const token2 = {
  ...tokenInfo,
  defuseAssetId: "token2",
  decimals: 8,
}
const token3 = {
  ...tokenInfo,
  defuseAssetId: "token3",
  decimals: 18,
}
const tokenOut = {
  ...tokenInfo,
  defuseAssetId: "tokenOut",
}

describe("queryQuote()", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("quotes full amount even if user has less funds than requested", async () => {
    const input = {
      tokensIn: [token1],
      tokenOut: tokenOut,
      amountIn: { amount: adjustDecimals(150n, 0, 6), decimals: 6 },
      balances: { token1: adjustDecimals(100n, 0, 6) },
    }

    vi.mocked(relayClient.quote).mockImplementationOnce(async () => [
      {
        quote_hash: "q1",
        defuse_asset_identifier_in: "token1",
        defuse_asset_identifier_out: "tokenOut",
        amount_in: "150000000",
        amount_out: "200",
        expiration_time: "2024-01-15T12:02:00.000Z",
      },
    ])

    const result = await queryQuote(input)

    expect(relayClient.quote).toHaveBeenCalledTimes(1)
    expect(relayClient.quote).toHaveBeenCalledWith(
      {
        defuse_asset_identifier_in: "token1",
        defuse_asset_identifier_out: "tokenOut",
        exact_amount_in: "150000000",
        min_deadline_ms: 60_000,
      },
      expect.any(Object)
    )
    expect(result).toEqual({
      tag: "ok",
      value: {
        expirationTime: "2024-01-15T12:02:00.000Z",
        quoteHashes: ["q1"],
        tokenDeltas: [
          ["token1", -150000000n],
          ["tokenOut", 200n],
        ],
      },
    })
  })

  it("splits amount across tokens if user has enough funds", async () => {
    const input = {
      tokensIn: [token1, token2, token3],
      tokenOut: tokenOut,
      amountIn: { amount: adjustDecimals(150n, 0, 6), decimals: 6 },
      balances: {
        token1: adjustDecimals(100n, 0, token1.decimals),
        token2: adjustDecimals(100n, 0, token2.decimals),
        token3: adjustDecimals(100n, 0, token3.decimals),
      },
    }

    vi.mocked(relayClient.quote)
      .mockImplementationOnce(async () => [
        {
          quote_hash: "q1",
          defuse_asset_identifier_in: "token1",
          defuse_asset_identifier_out: "tokenOut",
          amount_in: "100000000",
          amount_out: "20",
          expiration_time: "2024-01-15T12:02:00.000Z",
        },
      ])
      .mockImplementationOnce(async () => [
        {
          quote_hash: "q2",
          defuse_asset_identifier_in: "token2",
          defuse_asset_identifier_out: "tokenOut",
          amount_in: "5000000000",
          amount_out: "10",
          expiration_time: "2024-01-15T12:01:30.000Z",
        },
      ])

    const result = await queryQuote(input)

    expect(relayClient.quote).toHaveBeenCalledTimes(2)
    expect(relayClient.quote).toHaveBeenCalledWith(
      {
        defuse_asset_identifier_in: "token1",
        defuse_asset_identifier_out: "tokenOut",
        exact_amount_in: "100000000",
        min_deadline_ms: 60_000,
      },
      expect.any(Object)
    )
    expect(relayClient.quote).toHaveBeenCalledWith(
      {
        defuse_asset_identifier_in: "token2",
        defuse_asset_identifier_out: "tokenOut",
        exact_amount_in: "5000000000",
        min_deadline_ms: 60_000,
      },
      expect.any(Object)
    )
    expect(result).toEqual({
      tag: "ok",
      value: {
        expirationTime: "2024-01-15T12:01:30.000Z",
        quoteHashes: ["q1", "q2"],
        tokenDeltas: [
          ["token1", -100000000n],
          ["tokenOut", 20n],
          ["token2", -5000000000n],
          ["tokenOut", 10n],
        ],
      },
    })
  })

  it("takes a quote with the best return", async () => {
    const input = {
      tokensIn: [token1],
      tokenOut: tokenOut,
      amountIn: { amount: adjustDecimals(150n, 0, 6), decimals: 6 },
      balances: { token1: adjustDecimals(100n, 0, token1.decimals) },
    }

    vi.mocked(relayClient.quote).mockImplementationOnce(async () => [
      {
        quote_hash: "q1",
        defuse_asset_identifier_in: "token1",
        defuse_asset_identifier_out: "tokenOut",
        amount_in: "150",
        amount_out: "180",
        expiration_time: "2024-01-15T12:00:00.000Z",
      },
      {
        quote_hash: "q2",
        defuse_asset_identifier_in: "token1",
        defuse_asset_identifier_out: "tokenOut",
        amount_in: "150",
        amount_out: "200",
        expiration_time: "2024-01-15T12:02:00.000Z",
      },
      {
        quote_hash: "q3",
        defuse_asset_identifier_in: "token1",
        defuse_asset_identifier_out: "tokenOut",
        amount_in: "150",
        amount_out: "100",
        expiration_time: "2024-01-15T12:01:30.000Z",
      },
    ])

    const result = await queryQuote(input)

    expect(result).toEqual({
      tag: "ok",
      value: {
        expirationTime: "2024-01-15T12:02:00.000Z",
        quoteHashes: ["q2"],
        tokenDeltas: [
          ["token1", -150n],
          ["tokenOut", 200n],
        ],
      },
    })
  })

  it("returns empty result if quote is null", async () => {
    const input = {
      tokensIn: [token1],
      tokenOut: tokenOut,
      amountIn: { amount: adjustDecimals(150n, 0, 6), decimals: 6 },
      balances: { token1: adjustDecimals(100n, 0, token1.decimals) },
    }

    vi.mocked(relayClient.quote)
      .mockImplementationOnce(async () => null)
      .mockImplementationOnce(async () => [])

    await expect(queryQuote(input)).resolves.toEqual({
      tag: "err",
      value: {
        type: "NO_QUOTES",
      },
    })

    await expect(queryQuote(input)).resolves.toEqual({
      tag: "err",
      value: {
        type: "NO_QUOTES",
      },
    })
  })

  it("returns empty result if any quote is null", async () => {
    const input = {
      tokensIn: [token1, token2],
      tokenOut: tokenOut,
      amountIn: { amount: adjustDecimals(150n, 0, 6), decimals: 6 },
      balances: {
        token1: adjustDecimals(100n, 0, token1.decimals),
        token2: adjustDecimals(100n, 0, token2.decimals),
      },
    }

    vi.mocked(relayClient.quote)
      .mockImplementationOnce(async () => [
        {
          quote_hash: "q1",
          defuse_asset_identifier_in: "token1",
          defuse_asset_identifier_out: "tokenOut",
          amount_in: "100",
          amount_out: "20",
          expiration_time: "2024-01-15T12:02:00.000Z",
        },
      ])
      .mockImplementationOnce(async () => null)

    await expect(queryQuote(input)).resolves.toEqual({
      tag: "err",
      value: {
        type: "NO_QUOTES",
      },
    })
  })

  it("correctly handles duplicate input tokens", async () => {
    const input = {
      tokensIn: [token1, token1], // Duplicate token
      tokenOut: tokenOut,
      amountIn: { amount: adjustDecimals(150n, 0, 6), decimals: 6 },
      balances: { token1: adjustDecimals(100n, 0, token1.decimals) },
    }

    vi.mocked(relayClient.quote).mockImplementationOnce(async () => [
      {
        quote_hash: "q1",
        defuse_asset_identifier_in: "token1",
        defuse_asset_identifier_out: "tokenOut",
        amount_in: "150",
        amount_out: "200",
        expiration_time: "2024-01-15T12:02:00.000Z",
      },
    ])

    const result = await queryQuote(input)

    expect(relayClient.quote).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      tag: "ok",
      value: {
        expirationTime: expect.any(String),
        quoteHashes: ["q1"],
        tokenDeltas: [
          ["token1", -150n],
          ["tokenOut", 200n],
        ],
      },
    })
  })
})

describe("calculateSplitAmounts", () => {
  it("splits amounts when same decimals", () => {
    const tokensIn = [
      { ...token1, decimals: 0 },
      { ...token2, decimals: 0 },
      { ...token3, decimals: 0 },
    ]
    const amountIn = { amount: 150n, decimals: 0 }
    const balances = {
      token1: 100n,
      token2: 50n,
      token3: 200n,
    }
    const result = calculateSplitAmounts(tokensIn, amountIn, balances)
    expect(result).toEqual({
      token1: 100n,
      token2: 50n,
    })

    const total = sumTotal(tokensIn, result)
    expect(
      adjustDecimals(total.amount, total.decimals, amountIn.decimals)
    ).toEqual(amountIn.amount)
  })

  it("splits amounts when different decimals", () => {
    const tokensIn = [token1, token2, token3]
    const amountIn = { amount: adjustDecimals(150n, 0, 6), decimals: 6 }
    const balances = {
      token1: adjustDecimals(100n, 0, token1.decimals),
      token2: adjustDecimals(50n, 0, token2.decimals),
      token3: adjustDecimals(200n, 0, token3.decimals),
    }

    const result = calculateSplitAmounts(tokensIn, amountIn, balances)
    expect(result).toEqual({
      token1: 100_000_000n,
      token2: 5_000_000_000n,
    })

    const total = sumTotal(tokensIn, result)
    expect(
      adjustDecimals(total.amount, total.decimals, amountIn.decimals)
    ).toEqual(amountIn.amount)
  })

  it("only considers each token's balance once when duplicated", () => {
    const tokensIn = [token1, token1, token2, token2, token3]
    const amountIn = { amount: adjustDecimals(150n, 0, 6), decimals: 6 }
    const balances = {
      token1: adjustDecimals(100n, 0, token1.decimals),
      token2: adjustDecimals(50n, 0, token2.decimals),
      token3: adjustDecimals(200n, 0, token3.decimals),
    }

    const result = calculateSplitAmounts(tokensIn, amountIn, balances)
    expect(result).toEqual({
      token1: 100_000_000n,
      token2: 5_000_000_000n,
    })

    const total = sumTotal(tokensIn, result)
    expect(
      adjustDecimals(total.amount, total.decimals, amountIn.decimals)
    ).toEqual(amountIn.amount)
  })

  it("handles zero amount input", () => {
    const tokensIn = [token1, token2]
    const amountIn = { amount: 0n, decimals: 6 }
    const balances = {
      token1: adjustDecimals(100n, 0, token1.decimals),
      token2: adjustDecimals(50n, 0, token2.decimals),
    }

    const result = calculateSplitAmounts(tokensIn, amountIn, balances)
    expect(result).toEqual({})

    const total = sumTotal(tokensIn, result)
    expect(
      adjustDecimals(total.amount, total.decimals, amountIn.decimals)
    ).toEqual(amountIn.amount)
  })

  it("handles missing balances", () => {
    const tokensIn = [token1, token2]
    const amountIn = { amount: 100n, decimals: 6 } // 0.0001 with 6 decimals
    const balances = {
      token2: 50_000_000n, // 0.5 with 8 decimals
    }

    const result = calculateSplitAmounts(tokensIn, amountIn, balances)
    expect(result).toEqual({
      token2: 10_000n, // 0.0001 with 8 decimals
    })

    const total = sumTotal(tokensIn, result)
    expect(
      adjustDecimals(total.amount, total.decimals, amountIn.decimals)
    ).toEqual(amountIn.amount)
  })

  it("handles extreme decimal differences", () => {
    const smallDecimals = { ...token1, decimals: 0 }
    const largeDecimals = { ...token2, decimals: 24 }
    const tokensIn = [smallDecimals, largeDecimals]
    const amountIn = { amount: 100n, decimals: 12 } // 0.0000000001 with 12 decimals
    const balances = {
      [smallDecimals.defuseAssetId]: 1n,
      [largeDecimals.defuseAssetId]: 1_000_000_000_000_000_000_000_000n, // 1 with 24 decimals
    }

    const result = calculateSplitAmounts(tokensIn, amountIn, balances)
    expect(result).toEqual({
      [largeDecimals.defuseAssetId]: 100_000_000_000_000n, // 0.0000000001 with 24 decimals
    })

    const total = sumTotal(tokensIn, result)
    expect(
      adjustDecimals(total.amount, total.decimals, amountIn.decimals)
    ).toEqual(amountIn.amount)
  })

  it("handles very large numbers without overflow", () => {
    const tokensIn = [token1, token2]
    const amountIn = { amount: adjustDecimals(2n ** 64n, 0, 6), decimals: 6 }
    const balances = {
      token1: adjustDecimals(2n ** 64n, 0, token1.decimals) / 2n,
      token2: adjustDecimals(2n ** 64n, 0, token2.decimals) / 2n,
    }

    const result = calculateSplitAmounts(tokensIn, amountIn, balances)
    expect(result).toEqual(balances)

    const total = sumTotal(tokensIn, result)
    expect(
      adjustDecimals(total.amount, total.decimals, amountIn.decimals)
    ).toEqual(amountIn.amount)
  })

  it("handles different decimal precision between amount and tokens", () => {
    const tokensIn = [
      { ...token1, decimals: 18 },
      { ...token2, decimals: 6 },
    ]
    const amountIn = { amount: 1_000_000n, decimals: 12 } // 0.000001 with 12 decimals
    const balances = {
      token1: 1_000_000_000_000_000_000n, // 1 with 18 decimals
      token2: 1_000_000n, // 1 with 6 decimals
    }

    const result = calculateSplitAmounts(tokensIn, amountIn, balances)
    expect(result).toEqual({
      token1: 1_000_000_000_000n,
    })

    const total = sumTotal(tokensIn, result)
    expect(
      adjustDecimals(total.amount, total.decimals, amountIn.decimals)
    ).toEqual(amountIn.amount)
  })

  it("handles token duplicates", () => {
    const tokensIn = [{ ...token1 }, { ...token1 }, token2]
    const amountIn = { amount: adjustDecimals(200n, 0, 6), decimals: 6 }
    const balances = {
      token1: adjustDecimals(100n, 0, token1.decimals),
      token2: adjustDecimals(100n, 0, token2.decimals),
    }

    const result = calculateSplitAmounts(tokensIn, amountIn, balances)
    expect(result).toEqual({
      token1: 100_000_000n,
      token2: 10_000_000_000n,
    })

    const total = sumTotal(tokensIn, result)
    expect(
      adjustDecimals(total.amount, total.decimals, amountIn.decimals)
    ).toEqual(amountIn.amount)
  })

  it("throws AmountMismatchError when available amount is less than requested", () => {
    const tokensIn = [token1, token2]
    const amountIn = { amount: adjustDecimals(200n, 0, 6), decimals: 6 }
    const balances = {
      token1: adjustDecimals(100n, 0, token1.decimals),
      token2: adjustDecimals(50n, 0, token2.decimals),
    }

    expect(() => calculateSplitAmounts(tokensIn, amountIn, balances)).toThrow(
      AmountMismatchError
    )
  })

  it("throws AmountMismatchError when balances are zero", () => {
    const tokensIn = [token1, token2]
    const amountIn = { amount: 100n, decimals: 6 }
    const balances = {
      token1: 0n,
      token2: 0n,
    }

    expect(() => calculateSplitAmounts(tokensIn, amountIn, balances)).toThrow(
      AmountMismatchError
    )
  })

  it("throws AmountMismatchError when no balances available", () => {
    const tokensIn = [token1, token2]
    const amountIn = { amount: 100n, decimals: 6 }
    const balances = {}

    expect(() => calculateSplitAmounts(tokensIn, amountIn, balances)).toThrow(
      AmountMismatchError
    )
  })

  it("throws AmountMismatchError when tokens array is empty", () => {
    const tokensIn: (typeof token1)[] = []
    const amountIn = { amount: 100n, decimals: 6 }
    const balances = {}

    expect(() => calculateSplitAmounts(tokensIn, amountIn, balances)).toThrow(
      AmountMismatchError
    )
  })

  function sumTotal(
    tokensIn: BaseTokenInfo[],
    balances: Record<string, bigint>
  ): TokenValue {
    const a = computeTotalBalanceDifferentDecimals(
      tokensIn.filter((t) => Object.keys(balances).includes(t.defuseAssetId)),
      balances
    )
    assert(a != null)
    return a
  }
})

describe("aggregateQuotes()", () => {
  it("aggregates quotes correctly", () => {
    const quotes = [
      [
        {
          quote_hash: "q1",
          defuse_asset_identifier_in: "token1",
          defuse_asset_identifier_out: "tokenOut",
          amount_in: "1000000", // 1.0 with 6 decimals
          amount_out: "2000000", // 2.0 with 6 decimals
          expiration_time: "2024-01-15T12:05:00.000Z",
        },
      ],
      [
        {
          quote_hash: "q2",
          defuse_asset_identifier_in: "token2",
          defuse_asset_identifier_out: "tokenOut",
          amount_in: "100000000", // 1.0 with 8 decimals
          amount_out: "1000000", // 1.0 with 6 decimals
          expiration_time: "2024-01-15T12:04:00.000Z",
        },
      ],
    ]

    const result = aggregateQuotes(quotes)

    expect(result).toEqual({
      tag: "ok",
      value: {
        expirationTime: "2024-01-15T12:04:00.000Z",
        quoteHashes: ["q1", "q2"],
        tokenDeltas: [
          ["token1", -1000000n],
          ["tokenOut", 2000000n],
          ["token2", -100000000n],
          ["tokenOut", 1000000n],
        ],
      },
    })
  })

  it("sorts quotes by amount out with respect to decimals", () => {
    const quotes = [
      [
        {
          quote_hash: "q1",
          defuse_asset_identifier_in: "token1",
          defuse_asset_identifier_out: "tokenOut",
          amount_in: "1000000", // 1.0 with 6 decimals
          amount_out: "1000000", // 1.0 with 6 decimals
          expiration_time: "2024-01-15T12:05:00.000Z",
        },
        {
          quote_hash: "q2",
          defuse_asset_identifier_in: "token1",
          defuse_asset_identifier_out: "tokenOut",
          amount_in: "1000000", // 1.0 with 6 decimals
          amount_out: "2000000", // 2.0 with 6 decimals
          expiration_time: "2024-01-15T12:05:00.000Z",
        },
      ],
    ]

    const result = aggregateQuotes(quotes)

    expect(result.tag).toBe("ok")
    if (result.tag === "ok") {
      expect(result.value.quoteHashes).toEqual(["q2"]) // Should select q2 with better rate
    }
  })

  it("handles failed quotes", () => {
    const quotes = [
      [
        {
          type: "INSUFFICIENT_AMOUNT" as const,
          min_amount: "1000000",
        },
      ],
    ]

    const result = aggregateQuotes(quotes)

    expect(result).toEqual({
      tag: "err",
      value: {
        type: "INSUFFICIENT_AMOUNT",
        min_amount: "1000000",
      },
    })
  })

  it("returns NO_QUOTES when quotes array is empty", () => {
    const quotes: NonNullable<QuoteResponse["result"]>[] = []

    const result = aggregateQuotes(quotes)

    expect(result).toEqual({
      tag: "err",
      value: {
        type: "NO_QUOTES",
      },
    })
  })
})
