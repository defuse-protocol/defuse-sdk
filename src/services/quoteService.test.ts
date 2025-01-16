import { afterEach, describe, expect, it, vi } from "vitest"
import {
  aggregateQuotes,
  calculateSplitAmounts,
  queryQuote,
} from "./quoteService"

import * as relayClient from "./solverRelayHttpClient"

vi.spyOn(relayClient, "quote")

const token1 = {
  defuseAssetId: "token1",
}
const token2 = {
  defuseAssetId: "token2",
}
const token3 = {
  defuseAssetId: "token3",
}
const tokenOut = {
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
      amountIn: { amount: 150n, decimals: 6 },
      balances: { token1: 100n },
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
    expect(relayClient.quote).toHaveBeenCalledWith(
      {
        defuse_asset_identifier_in: "token1",
        defuse_asset_identifier_out: "tokenOut",
        exact_amount_in: "150",
        min_deadline_ms: 120_000,
      },
      expect.any(Object)
    )
    expect(result).toEqual({
      tag: "ok",
      value: {
        amountsIn: { token1: 150n },
        amountsOut: { tokenOut: 200n },
        expirationTime: "2024-01-15T12:02:00.000Z",
        quoteHashes: ["q1"],
        totalAmountIn: 150n,
        totalAmountOut: 200n,
        tokenDeltas: [
          ["token1", -150n],
          ["tokenOut", 200n],
        ],
      },
    })
  })

  it("splits amount across tokens if user has enough funds", async () => {
    const input = {
      tokensIn: [token1, token2, token3],
      tokenOut: tokenOut,
      amountIn: { amount: 150n, decimals: 6 },
      balances: { token1: 100n, token2: 100n, token3: 100n },
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
      .mockImplementationOnce(async () => [
        {
          quote_hash: "q2",
          defuse_asset_identifier_in: "token2",
          defuse_asset_identifier_out: "tokenOut",
          amount_in: "50",
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
        exact_amount_in: "100",
        min_deadline_ms: 120_000,
      },
      expect.any(Object)
    )
    expect(relayClient.quote).toHaveBeenCalledWith(
      {
        defuse_asset_identifier_in: "token2",
        defuse_asset_identifier_out: "tokenOut",
        exact_amount_in: "50",
        min_deadline_ms: 120_000,
      },
      expect.any(Object)
    )
    expect(result).toEqual({
      tag: "ok",
      value: {
        amountsIn: { token1: 100n, token2: 50n },
        amountsOut: { tokenOut: 30n },
        expirationTime: "2024-01-15T12:01:30.000Z",
        quoteHashes: ["q1", "q2"],
        totalAmountIn: 150n,
        totalAmountOut: 30n,
        tokenDeltas: [
          ["token1", -100n],
          ["tokenOut", 20n],
          ["token2", -50n],
          ["tokenOut", 10n],
        ],
      },
    })
  })

  it("takes a quote with the best return", async () => {
    const input = {
      tokensIn: [token1],
      tokenOut: tokenOut,
      amountIn: { amount: 150n, decimals: 6 },
      balances: { token1: 100n },
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
        amountsIn: { token1: 150n },
        amountsOut: { tokenOut: 200n },
        expirationTime: "2024-01-15T12:02:00.000Z",
        quoteHashes: ["q2"],
        totalAmountIn: 150n,
        totalAmountOut: 200n,
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
      amountIn: { amount: 150n, decimals: 6 },
      balances: { token1: 100n },
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
      amountIn: { amount: 150n, decimals: 6 },
      balances: { token1: 100n, token2: 100n },
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
      amountIn: { amount: 150n, decimals: 6 },
      balances: { token1: 100n },
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
    expect(result.tag === "ok" && result.value.totalAmountIn).toBe(150n)
  })
})

it("calculateSplitAmounts(): splits amounts correctly", () => {
  const tokensIn = [token1, token2, token3]
  const amountIn = 150n
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
})

it("calculateSplitAmounts(): only considers each token's balance once when duplicated", () => {
  const tokensIn = [token1, token1, token2, token2, token3]
  const amountIn = 150n
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
})

it("aggregateQuotes(): aggregates quotes correctly", () => {
  const quotes = [
    [
      {
        quote_hash: "q1",
        defuse_asset_identifier_in: "token1",
        defuse_asset_identifier_out: "tokenOut",
        amount_in: "100",
        amount_out: "200",
        expiration_time: "2024-01-15T12:05:00.000Z",
      },
    ],
    [
      {
        quote_hash: "q2",
        defuse_asset_identifier_in: "token2",
        defuse_asset_identifier_out: "tokenOut",
        amount_in: "50",
        amount_out: "100",
        expiration_time: "2024-01-15T12:04:00.000Z",
      },
    ],
  ]

  const result = aggregateQuotes(quotes)

  expect(result).toEqual({
    tag: "ok",
    value: {
      amountsIn: { token1: 100n, token2: 50n },
      amountsOut: { tokenOut: 300n },
      expirationTime: "2024-01-15T12:04:00.000Z",
      quoteHashes: ["q1", "q2"],
      totalAmountIn: 150n,
      totalAmountOut: 300n,
      tokenDeltas: [
        ["token1", -100n],
        ["tokenOut", 200n],
        ["token2", -50n],
        ["tokenOut", 100n],
      ],
    },
  })
})
