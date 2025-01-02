import { settings } from "../config/settings"
import { logger } from "../logger"
import type { BaseTokenInfo } from "../types/base"
import { computeTotalBalance } from "../utils/tokenUtils"
import { quote } from "./solverRelayHttpClient"
import type { QuoteResponse } from "./solverRelayHttpClient/types"

export interface AggregatedQuoteParams {
  tokensIn: string[] // set of close tokens, e.g. [USDC on Solana, USDC on Ethereum, USDC on Near]
  tokensOut: string[] // set of close tokens, e.g. [USDC on Solana, USDC on Ethereum, USDC on Near]
  amountIn: bigint // total amount in
  balances: Record<string, bigint> // how many tokens of each type are available
}

export interface AggregatedQuote {
  quoteHashes: string[]
  /** Earliest expiration time in ISO-8601 format */
  expirationTime: string
  totalAmountIn: bigint
  totalAmountOut: bigint
  /** @deprecated */
  amountsIn: Record<string, bigint> // amount in for each token
  /** @deprecated */
  amountsOut: Record<string, bigint> // amount out for each token
  tokenDeltas: [string, bigint][]
}

type QuoteResults = QuoteResponse["result"]

const BLANK_AGGREGATED_QUOTE: AggregatedQuote = Object.freeze({
  quoteHashes: [],
  expirationTime: new Date(0).toISOString(),
  totalAmountIn: 0n,
  totalAmountOut: 0n,
  amountsIn: {},
  amountsOut: {},
  tokenDeltas: [],
})

export async function queryQuote(
  input: AggregatedQuoteParams,
  {
    signal,
  }: {
    signal?: AbortSignal
  } = {}
): Promise<AggregatedQuote> {
  // Sanity checks
  const tokenOut = input.tokensOut[0]
  assert(tokenOut != null, "tokensOut is empty")

  const tokenIn = input.tokensIn[0]
  assert(tokenIn != null, "tokensIn is empty")

  const totalAvailableIn = computeTotalBalance(input.tokensIn, input.balances)

  // If total available is less than requested, just quote the full amount from one token
  if (totalAvailableIn == null || totalAvailableIn < input.amountIn) {
    const q = await quoteWithLog(
      {
        defuse_asset_identifier_in: tokenIn,
        defuse_asset_identifier_out: tokenOut,
        exact_amount_in: input.amountIn.toString(),
        min_deadline_ms: settings.quoteMinDeadlineMs,
      },
      { signal }
    )

    if (q == null) {
      return BLANK_AGGREGATED_QUOTE
    }

    return aggregateQuotes([q])
  }

  const amountsToQuote = calculateSplitAmounts(
    input.tokensIn,
    input.amountIn,
    input.balances
  )

  const quotes = await fetchQuotesForTokens(tokenOut, amountsToQuote, {
    signal,
  })

  if (quotes == null) {
    return BLANK_AGGREGATED_QUOTE
  }

  return aggregateQuotes(quotes)
}

export async function queryQuoteExactOut(
  input: {
    tokenIn: BaseTokenInfo["defuseAssetId"]
    tokenOut: BaseTokenInfo["defuseAssetId"]
    exactAmountOut: bigint
    minDeadlineMs?: number
  },
  { signal }: { signal?: AbortSignal } = {}
): Promise<AggregatedQuote> {
  const quotes = await quoteWithLog(
    {
      defuse_asset_identifier_in: input.tokenIn,
      defuse_asset_identifier_out: input.tokenOut,
      exact_amount_out: input.exactAmountOut.toString(),
      min_deadline_ms: input.minDeadlineMs ?? settings.quoteMinDeadlineMs,
    },
    { signal }
  )

  if (quotes == null) {
    return BLANK_AGGREGATED_QUOTE
  }

  quotes.sort((a, b) => {
    // Sort by `amount_in` in ascending order, because backend does not sort
    if (BigInt(a.amount_in) < BigInt(b.amount_in)) return -1
    if (BigInt(a.amount_in) > BigInt(b.amount_in)) return 1
    return 0
  })

  const bestQuote = quotes[0]
  assert(bestQuote != null, "No valid quotes")

  return {
    quoteHashes: [bestQuote.quote_hash],
    expirationTime: bestQuote.expiration_time,
    totalAmountIn: BigInt(bestQuote.amount_in),
    totalAmountOut: BigInt(bestQuote.amount_out),
    amountsIn: { [input.tokenIn]: BigInt(bestQuote.amount_in) },
    amountsOut: { [input.tokenOut]: BigInt(bestQuote.amount_out) },
    tokenDeltas: [
      [input.tokenIn, -BigInt(bestQuote.amount_in)],
      [input.tokenOut, BigInt(bestQuote.amount_out)],
    ],
  }
}

function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}

function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}

/**
 * Function to calculate how to split the input amounts based on available balances.
 * Duplicate tokens are processed only once and their balances are considered only once.
 */
export function calculateSplitAmounts(
  tokensIn: string[],
  amountIn: bigint,
  balances: Record<string, bigint>
): Record<string, bigint> {
  let remainingAmountIn = amountIn
  const amountsToQuote: Record<string, bigint> = {}

  // Deduplicate tokens
  const uniqueTokensIn = new Set(tokensIn)

  for (const tokenIn of uniqueTokensIn) {
    const availableIn = balances[tokenIn] ?? 0n
    const amountToQuote = min(availableIn, remainingAmountIn)

    if (amountToQuote > 0n) {
      amountsToQuote[tokenIn] = amountToQuote
      remainingAmountIn -= amountToQuote
    }

    if (remainingAmountIn === 0n) break
  }

  return amountsToQuote
}

export function aggregateQuotes(
  quotes: NonNullable<QuoteResults>[]
): AggregatedQuote {
  let totalAmountIn = 0n
  let totalAmountOut = 0n
  const amountsIn: Record<string, bigint> = {}
  const amountsOut: Record<string, bigint> = {}
  const quoteHashes: string[] = []
  let expirationTime = Number.POSITIVE_INFINITY
  const tokenDeltas: [string, bigint][] = []

  for (const qList of quotes) {
    qList.sort((a, b) => {
      // Sort by `amount_out` in descending order, because backend does not sort
      if (BigInt(a.amount_out) > BigInt(b.amount_out)) return -1
      if (BigInt(a.amount_out) < BigInt(b.amount_out)) return 1
      return 0
    })

    const q = qList[0]
    if (q === undefined) continue

    const amountOut = BigInt(q.amount_out)
    const amountIn = BigInt(q.amount_in)

    totalAmountIn += amountIn
    totalAmountOut += amountOut

    expirationTime = Math.min(
      expirationTime,
      new Date(q.expiration_time).getTime()
    )

    amountsIn[q.defuse_asset_identifier_in] ??= 0n
    amountsIn[q.defuse_asset_identifier_in] += amountIn
    amountsOut[q.defuse_asset_identifier_out] ??= 0n
    amountsOut[q.defuse_asset_identifier_out] += amountOut

    tokenDeltas.push([q.defuse_asset_identifier_in, -amountIn])
    tokenDeltas.push([q.defuse_asset_identifier_out, amountOut])

    quoteHashes.push(q.quote_hash)
  }

  return {
    quoteHashes,
    expirationTime: new Date(
      expirationTime === Number.POSITIVE_INFINITY ? 0 : expirationTime
    ).toISOString(),
    totalAmountIn,
    totalAmountOut,
    amountsIn,
    amountsOut,
    tokenDeltas,
  }
}

export async function fetchQuotesForTokens(
  tokenOut: string,
  amountsToQuote: Record<string, bigint>,
  { signal }: { signal?: AbortSignal } = {}
): Promise<null | NonNullable<QuoteResults>[]> {
  const quotes = await Promise.all(
    Object.entries(amountsToQuote).map(async ([tokenIn, amountIn]) => {
      return quoteWithLog(
        {
          defuse_asset_identifier_in: tokenIn,
          defuse_asset_identifier_out: tokenOut,
          exact_amount_in: amountIn.toString(),
          min_deadline_ms: settings.quoteMinDeadlineMs,
        },
        { signal }
      )
    })
  )

  return ensureAllNonNull(quotes)
}

export function isAggregatedQuoteEmpty(a: AggregatedQuote): boolean {
  return !a.quoteHashes.length || a.totalAmountOut === 0n
}

function ensureAllNonNull<T>(array: (T | null)[]): T[] | null {
  const filtered = array.filter((x): x is T => x !== null)
  return filtered.length === array.length ? filtered : null
}

const quoteWithLog = (async (params, config) => {
  const result = await quote(params, config)
  if (result == null) {
    logger.warn("No liquidity", { quoteParams: params })
  }
  return result
}) satisfies typeof quote
