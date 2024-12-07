import { settings } from "../config/settings"
import type { BaseTokenInfo } from "../types"
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
  /** Earliest expiration time in seconds */
  expirationTime: number
  totalAmountIn: bigint
  totalAmountOut: bigint
  /** @deprecated */
  amountsIn: Record<string, bigint> // amount in for each token
  /** @deprecated */
  amountsOut: Record<string, bigint> // amount out for each token
  tokenDeltas: [string, bigint][]
}

type QuoteResults = QuoteResponse["result"]

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

  // Calculate the total amount available across all input tokens
  const totalAvailableIn = input.tokensIn.reduce((sum, token) => {
    return sum + (input.balances[token] ?? 0n)
  }, 0n)

  // If total available is less than requested, just quote the full amount from one token
  if (totalAvailableIn < input.amountIn) {
    const q = await quote(
      {
        defuse_asset_identifier_in: tokenIn,
        defuse_asset_identifier_out: tokenOut,
        exact_amount_in: input.amountIn.toString(),
        min_deadline_ms: settings.quoteMinDeadlineMs,
      },
      { signal }
    )

    return aggregateQuotes([onlyValidQuotes(q)])
  }

  const amountsToQuote = calculateSplitAmounts(
    input.tokensIn,
    input.amountIn,
    input.balances
  )

  const quotes = await fetchQuotesForTokens(
    input.tokensIn,
    tokenOut,
    amountsToQuote,
    { signal }
  )

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
  const quotes = await quote(
    {
      defuse_asset_identifier_in: input.tokenIn,
      defuse_asset_identifier_out: input.tokenOut,
      exact_amount_out: input.exactAmountOut.toString(),
      min_deadline_ms: input.minDeadlineMs ?? settings.quoteMinDeadlineMs,
    },
    { signal }
  )

  if (quotes == null) {
    return {
      quoteHashes: [],
      expirationTime: 0,
      totalAmountIn: 0n,
      totalAmountOut: 0n,
      amountsIn: {},
      amountsOut: {},
      tokenDeltas: [],
    }
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
 * Function to calculate how to split the input amounts based on available balances
 */
export function calculateSplitAmounts(
  tokensIn: string[],
  amountIn: bigint,
  balances: Record<string, bigint>
): Record<string, bigint> {
  let remainingAmountIn = amountIn
  const amountsToQuote: Record<string, bigint> = {}

  for (const tokenIn of tokensIn) {
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

    expirationTime = Math.min(expirationTime, q.expiration_time)

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
    expirationTime:
      expirationTime === Number.POSITIVE_INFINITY ? 0 : expirationTime,
    totalAmountIn,
    totalAmountOut,
    amountsIn,
    amountsOut,
    tokenDeltas,
  }
}

export async function fetchQuotesForTokens(
  tokensIn: string[],
  tokenOut: string,
  amountsToQuote: Record<string, bigint>,
  { signal }: { signal?: AbortSignal } = {}
): Promise<NonNullable<QuoteResults>[]> {
  const quotes = await Promise.all(
    tokensIn.map(async (tokenIn) => {
      const amountIn = amountsToQuote[tokenIn]
      if (amountIn === undefined || amountIn === 0n) return null

      return quote(
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

  return quotes.map(onlyValidQuotes)
}

function onlyValidQuotes(quotes: QuoteResults): NonNullable<QuoteResults> {
  if (quotes === null) return []
  return quotes.filter((q): q is NonNullable<typeof q> => q !== null)
}

export function isAggregatedQuoteEmpty(a: AggregatedQuote): boolean {
  return !a.quoteHashes.length || a.totalAmountOut === 0n
}
