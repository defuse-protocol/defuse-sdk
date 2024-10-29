import { afterEach, describe, expect, it, vi } from "vitest"
import {
  aggregateQuotes,
  calculateSplitAmounts,
  queryQuote,
} from "./queryQuoteMachine"

import * as relayClient from "../../services/solverRelayHttpClient"

vi.spyOn(relayClient, "quote")

describe("queryQuote()", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("quotes full amount if total available is less than requested", async () => {
    const input = {
      tokensIn: ["token1"],
      tokensOut: ["tokenOut"],
      amountIn: 150n,
      balances: { token1: 100n },
    }

    vi.mocked(relayClient.quote).mockImplementationOnce(async () => [
      {
        quote_hash: "q1",
        defuse_asset_identifier_in: "token1",
        defuse_asset_identifier_out: "tokenOut",
        amount_in: "150",
        amount_out: "200",
        expiration_time: 500,
      },
    ])

    const result = await queryQuote(input)

    expect(relayClient.quote).toHaveBeenCalledTimes(1)
    expect(relayClient.quote).toHaveBeenCalledWith(
      {
        defuse_asset_identifier_in: "token1",
        defuse_asset_identifier_out: "tokenOut",
        amount_in: "150",
        min_deadline_ms: 120_000,
      },
      expect.any(Object)
    )
    expect(result).toEqual({
      amountsIn: { token1: 150n },
      amountsOut: { tokenOut: 200n },
      expirationTime: 500,
      quoteHashes: ["q1"],
      totalAmountIn: 150n,
      totalAmountOut: 200n,
    })
  })

  it("splits amount across tokens if available balance is sufficient", async () => {
    const input = {
      tokensIn: ["token1", "token2"],
      tokensOut: ["tokenOut"],
      amountIn: 150n,
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
          expiration_time: 500,
        },
      ])
      .mockImplementationOnce(async () => [
        {
          quote_hash: "q2",
          defuse_asset_identifier_in: "token2",
          defuse_asset_identifier_out: "tokenOut",
          amount_in: "50",
          amount_out: "10",
          expiration_time: 500,
        },
      ])

    const result = await queryQuote(input)

    expect(relayClient.quote).toHaveBeenCalledTimes(2)
    expect(relayClient.quote).toHaveBeenCalledWith(
      {
        defuse_asset_identifier_in: "token1",
        defuse_asset_identifier_out: "tokenOut",
        amount_in: "100",
        min_deadline_ms: 120_000,
      },
      expect.any(Object)
    )
    expect(relayClient.quote).toHaveBeenCalledWith(
      {
        defuse_asset_identifier_in: "token2",
        defuse_asset_identifier_out: "tokenOut",
        amount_in: "50",
        min_deadline_ms: 120_000,
      },
      expect.any(Object)
    )
    expect(result).toEqual({
      amountsIn: { token1: 100n, token2: 50n },
      amountsOut: { tokenOut: 30n },
      expirationTime: 500,
      quoteHashes: ["q1", "q2"],
      totalAmountIn: 150n,
      totalAmountOut: 30n,
    })
  })

  it("takes only first quote", async () => {
    const input = {
      tokensIn: ["token1"],
      tokensOut: ["tokenOut"],
      amountIn: 150n,
      balances: { token1: 100n },
    }

    vi.mocked(relayClient.quote).mockImplementationOnce(async () => [
      {
        quote_hash: "q1",
        defuse_asset_identifier_in: "token1",
        defuse_asset_identifier_out: "tokenOut",
        amount_in: "150",
        amount_out: "200",
        expiration_time: 500,
      },
      {
        quote_hash: "q2",
        defuse_asset_identifier_in: "token1",
        defuse_asset_identifier_out: "tokenOut",
        amount_in: "150",
        amount_out: "180",
        expiration_time: 500,
      },
    ])

    const result = await queryQuote(input)

    expect(result).toEqual({
      amountsIn: { token1: 150n },
      amountsOut: { tokenOut: 200n },
      expirationTime: 500,
      quoteHashes: ["q1"],
      totalAmountIn: 150n,
      totalAmountOut: 200n,
    })
  })

  it("returns empty result if quote is null", async () => {
    const input = {
      tokensIn: ["token1"],
      tokensOut: ["tokenOut"],
      amountIn: 150n,
      balances: { token1: 100n },
    }

    vi.mocked(relayClient.quote)
      .mockImplementationOnce(async () => null)
      .mockImplementationOnce(async () => [])

    await expect(queryQuote(input)).resolves.toEqual({
      amountsIn: {},
      amountsOut: {},
      expirationTime: 0,
      quoteHashes: [],
      totalAmountIn: 0n,
      totalAmountOut: 0n,
    })

    await expect(queryQuote(input)).resolves.toEqual({
      amountsIn: {},
      amountsOut: {},
      expirationTime: 0,
      quoteHashes: [],
      totalAmountIn: 0n,
      totalAmountOut: 0n,
    })
  })
})

it("calculateSplitAmounts(): splits amounts correctly", () => {
  const tokensIn = ["token1", "token2", "token3"]
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
        expiration_time: 5000,
      },
    ],
    [
      {
        quote_hash: "q2",
        defuse_asset_identifier_in: "token2",
        defuse_asset_identifier_out: "tokenOut",
        amount_in: "50",
        amount_out: "100",
        expiration_time: 4000,
      },
    ],
  ]

  const result = aggregateQuotes(quotes)

  expect(result).toEqual({
    amountsIn: { token1: 100n, token2: 50n },
    amountsOut: { tokenOut: 300n },
    expirationTime: 4000,
    quoteHashes: ["q1", "q2"],
    totalAmountIn: 150n,
    totalAmountOut: 300n,
  })
})
