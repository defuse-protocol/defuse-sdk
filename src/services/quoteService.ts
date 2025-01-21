import { settings } from "../config/settings"
import { logger } from "../logger"
import type { BaseTokenInfo, TokenValue } from "../types/base"
import {
  adjustDecimals,
  compareAmounts,
  computeTotalBalanceDifferentDecimals,
} from "../utils/tokenUtils"
import { quote } from "./solverRelayHttpClient"
import type {
  FailedQuote,
  Quote,
  QuoteResponse,
} from "./solverRelayHttpClient/types"

function isFailedQuote(quote: Quote | FailedQuote): quote is FailedQuote {
  return "type" in quote
}

type TokenSlice = BaseTokenInfo

export interface AggregatedQuoteParams {
  tokensIn: TokenSlice[] // set of close tokens, e.g. [USDC on Solana, USDC on Ethereum, USDC on Near]
  tokenOut: TokenSlice // set of close tokens, e.g. [USDC on Solana, USDC on Ethereum, USDC on Near]
  amountIn: TokenValue // total amount in
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

export type QuoteResult =
  | {
      tag: "ok"
      value: AggregatedQuote
    }
  | {
      tag: "err"
      value:
        | FailedQuote
        | {
            type: "NO_QUOTES"
          }
    }
export async function queryQuote(
  input: AggregatedQuoteParams,
  {
    signal,
  }: {
    signal?: AbortSignal
  } = {}
): Promise<QuoteResult> {
  // Sanity checks
  const tokenOut = input.tokenOut

  const tokenIn = input.tokensIn[0]
  assert(tokenIn != null, "tokensIn is empty")

  const totalAvailableIn = computeTotalBalanceDifferentDecimals(
    input.tokensIn,
    input.balances
  )

  // If total available is less than requested, just quote the full amount from one token
  if (
    totalAvailableIn == null ||
    compareAmounts(totalAvailableIn, input.amountIn) === -1
  ) {
    const exactAmountIn: bigint = adjustDecimals(
      input.amountIn.amount,
      input.amountIn.decimals,
      tokenIn.decimals
    )
    const q = await quoteWithLog(
      {
        defuse_asset_identifier_in: tokenIn.defuseAssetId,
        defuse_asset_identifier_out: tokenOut.defuseAssetId,
        exact_amount_in: exactAmountIn.toString(),
        min_deadline_ms: settings.quoteMinDeadlineMs,
      },
      { signal }
    )

    if (q == null) {
      return {
        tag: "err",
        value: {
          type: "NO_QUOTES",
        },
      }
    }

    return aggregateQuotes([q])
  }

  const amountsToQuote = calculateSplitAmounts(
    input.tokensIn,
    input.amountIn,
    input.balances
  )

  const quotes = await fetchQuotesForTokens(
    tokenOut.defuseAssetId,
    amountsToQuote,
    {
      signal,
    }
  )

  if (quotes == null) {
    return {
      tag: "err",
      value: {
        type: "NO_QUOTES",
      },
    }
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
): Promise<QuoteResult> {
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
    return {
      tag: "err",
      value: {
        type: "NO_QUOTES",
      },
    }
  }

  const failedQuotes: FailedQuote[] = []
  const validQuotes = []
  for (const q of quotes) {
    if (isFailedQuote(q)) {
      failedQuotes.push(q)
    } else {
      validQuotes.push(q)
    }
  }

  validQuotes.sort((a, b) => {
    // Sort by `amount_in` in ascending order, because backend does not sort
    if (BigInt(a.amount_in) < BigInt(b.amount_in)) return -1
    if (BigInt(a.amount_in) > BigInt(b.amount_in)) return 1
    return 0
  })

  const bestQuote = validQuotes[0]

  if (bestQuote) {
    return {
      tag: "ok",
      value: {
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
      },
    }
  }

  if (failedQuotes[0]) {
    return {
      tag: "err",
      value: failedQuotes[0],
    }
  }

  return {
    tag: "err",
    value: {
      type: "NO_QUOTES",
    },
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
  tokensIn: TokenSlice[],
  amountIn: TokenValue,
  balances: Record<string, bigint>
): Record<string, bigint> {
  const amountsToQuote: Record<string, bigint> = {}

  // Deduplicate tokens
  const uniqueTokensIn = new Set(tokensIn)

  let remainingAmount = amountIn.amount
  const remainingDecimals = amountIn.decimals

  for (const tokenIn of uniqueTokensIn) {
    const availableIn = balances[tokenIn.defuseAssetId] ?? 0n

    // Convert remaining amount to token's decimals
    const normalizedRemainingAmount = adjustDecimals(
      remainingAmount,
      remainingDecimals,
      tokenIn.decimals
    )

    const amountToQuote = min(availableIn, normalizedRemainingAmount)

    if (amountToQuote > 0n) {
      amountsToQuote[tokenIn.defuseAssetId] = amountToQuote

      // Convert back to original decimals to subtract from remaining
      remainingAmount -= adjustDecimals(
        amountToQuote,
        tokenIn.decimals,
        remainingDecimals
      )
    }

    if (remainingAmount === 0n) break
  }

  const totalAmountIn = computeTotalBalanceDifferentDecimals(
    tokensIn.filter((t) => t.defuseAssetId in amountsToQuote),
    amountsToQuote
  )

  if (totalAmountIn == null || compareAmounts(totalAmountIn, amountIn) !== 0) {
    throw new AmountMismatchError(amountIn)
  }

  return amountsToQuote
}

export class AmountMismatchError extends Error {
  constructor(requested: TokenValue) {
    super(
      `Unable to fulfill requested amount ${requested.amount} (decimals: ${requested.decimals}) from provided tokens`
    )
    this.name = "AmountMismatchError"
  }
}

export function aggregateQuotes(
  quotes: NonNullable<QuoteResults>[]
): QuoteResult {
  let totalAmountIn = 0n
  let totalAmountOut = 0n
  const amountsIn: Record<string, bigint> = {}
  const amountsOut: Record<string, bigint> = {}
  const quoteHashes: string[] = []
  let expirationTime = Number.POSITIVE_INFINITY
  const tokenDeltas: [string, bigint][] = []
  let quoteError: FailedQuote | null = null
  for (const qList of quotes) {
    const failedQuotes: FailedQuote[] = []
    const validQuotes = []
    for (const q of qList) {
      if (isFailedQuote(q)) {
        failedQuotes.push(q)
      } else {
        validQuotes.push(q)
      }
    }

    validQuotes.sort((a, b) => {
      if (BigInt(a.amount_out) > BigInt(b.amount_out)) return -1
      if (BigInt(a.amount_out) < BigInt(b.amount_out)) return 1
      return 0
    })

    const q = validQuotes[0]
    if (failedQuotes[0]) {
      if (quoteError === null) quoteError = failedQuotes[0]
    }

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

  const noQuotes = quoteHashes.length === 0

  if (noQuotes && quoteError !== null) {
    return {
      tag: "err",
      value: quoteError,
    }
  }

  if (noQuotes) {
    return {
      tag: "err",
      value: {
        type: "NO_QUOTES",
      },
    }
  }

  return {
    tag: "ok",
    value: {
      quoteHashes,
      expirationTime: new Date(
        expirationTime === Number.POSITIVE_INFINITY ? 0 : expirationTime
      ).toISOString(),
      totalAmountIn,
      totalAmountOut,
      amountsIn,
      amountsOut,
      tokenDeltas,
    },
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
