import { settings } from "../constants/settings"
import { logger } from "../logger"
import type { BaseTokenInfo, TokenValue } from "../types/base"
import { assert } from "../utils/assert"
import {
  adjustDecimals,
  compareAmounts,
  computeTotalBalanceDifferentDecimals,
  deduplicateTokens,
} from "../utils/tokenUtils"
import { quote } from "./solverRelayHttpClient"
import type {
  FailedQuote,
  Quote,
  QuoteResponse,
} from "./solverRelayHttpClient/types"

export function isFailedQuote(
  quote: Quote | FailedQuote
): quote is FailedQuote {
  return "type" in quote
}

function isNotFailedQuote(quote: Quote | FailedQuote): quote is Quote {
  return !("type" in quote)
}

type TokenSlice = BaseTokenInfo
type Balances = Record<string, bigint>

interface BaseQuoteParams {
  waitMs: number
}

export interface AggregatedQuoteParams extends BaseQuoteParams {
  tokensIn: TokenSlice[] // set of close tokens, e.g. [USDC on Solana, USDC on Ethereum, USDC on Near]
  tokenOut: TokenSlice // set of close tokens, e.g. [USDC on Solana, USDC on Ethereum, USDC on Near]
  amountIn: TokenValue // total amount in
  balances: Record<string, bigint> // how many tokens of each type are available
}

export interface AggregatedQuote {
  quoteHashes: string[]
  /** Earliest expiration time in ISO-8601 format */
  expirationTime: string
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
        wait_ms: input.waitMs,
      },
      {
        logBalanceSufficient: false,
        fetchOptions: { signal },
      }
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
    input.waitMs,
    {
      signal,
      logBalanceSufficient: true,
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
  {
    logBalanceSufficient,
    signal,
  }: {
    logBalanceSufficient: boolean
    signal?: AbortSignal
  }
): Promise<QuoteResult> {
  const quotes = await quoteWithLog(
    {
      defuse_asset_identifier_in: input.tokenIn,
      defuse_asset_identifier_out: input.tokenOut,
      exact_amount_out: input.exactAmountOut.toString(),
      min_deadline_ms: input.minDeadlineMs ?? settings.quoteMinDeadlineMs,
    },

    {
      fetchOptions: { signal },
      logBalanceSufficient: logBalanceSufficient,
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

/**
 * First sorting per decimals ascending - Reason: as fewer decimals have coverage problems, it is better to use them first
 * Second sorting per decimals descending - Reason: use less items to cover the split
 */
export function sortForOptimalAmountSplitting(
  uniqueTokensIn: BaseTokenInfo[],
  balances: Balances
): BaseTokenInfo[] {
  return structuredClone(uniqueTokensIn).sort((a, b) => {
    if (b.decimals < a.decimals) {
      return 1
    }
    if (b.decimals > a.decimals) {
      return -1
    }
    const aBalance = balances[a.defuseAssetId]
    const bBalance = balances[b.defuseAssetId]

    assert(aBalance != null)
    assert(bBalance != null)

    const maxDecimalBetweenAandB = Math.max(a.decimals, b.decimals) // taking max from decimals to ave cleaner comparing
    const aBalanceAdjusted = adjustDecimals(
      aBalance,
      a.decimals,
      maxDecimalBetweenAandB
    )
    const bBalanceAdjusted = adjustDecimals(
      bBalance,
      b.decimals,
      maxDecimalBetweenAandB
    )

    if (bBalanceAdjusted < aBalanceAdjusted) {
      return -1
    }

    if (bBalanceAdjusted > aBalanceAdjusted) {
      return 1
    }

    return 0
  })
}

/**
 * Function to calculate how to split the input amounts based on available balances.
 * Duplicate tokens are processed only once and their balances are considered only once.
 */
export function calculateSplitAmounts(
  tokensIn: TokenSlice[],
  amountIn: TokenValue,
  balances: Balances
): Record<string, bigint> {
  const amountsToQuote: Record<string, bigint> = {}

  const uniqueTokensIn_ = deduplicateTokens(tokensIn)
  const uniqueTokensIn = sortForOptimalAmountSplitting(
    uniqueTokensIn_,
    balances
  )

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

  if (remainingAmount !== 0n) {
    throw new AmountMismatchError(
      { amount: amountIn.amount, decimals: amountIn.decimals },
      { amount: remainingAmount, decimals: remainingDecimals }
    )
  }

  return amountsToQuote
}

export class AmountMismatchError extends Error {
  constructor(requested: TokenValue, remaining: TokenValue) {
    super(
      `Unable to fulfill requested amount ${requested.amount} (decimals: ${requested.decimals}) with remaining amount ${remaining.amount} (decimals: ${remaining.decimals})`
    )
    this.name = "AmountMismatchError"
  }
}

export function aggregateQuotes(
  quotes: NonNullable<QuoteResults>[]
): QuoteResult {
  const quoteHashes: string[] = []
  let expirationTime = Number.POSITIVE_INFINITY
  const tokenDeltas: [string, bigint][] = []
  let anyQuoteError: FailedQuote | undefined

  for (const qList of quotes) {
    const failedQuotes = qList.filter(isFailedQuote)
    const validQuotes = qList.filter(isNotFailedQuote)

    validQuotes.sort((a, b) => {
      if (BigInt(a.amount_out) > BigInt(b.amount_out)) return -1
      if (BigInt(a.amount_out) < BigInt(b.amount_out)) return 1
      return 0
    })

    anyQuoteError ??= failedQuotes[0]

    const q = validQuotes[0]
    if (q == null) continue

    const amountOut = BigInt(q.amount_out)
    const amountIn = BigInt(q.amount_in)

    expirationTime = Math.min(
      expirationTime,
      new Date(q.expiration_time).getTime()
    )

    tokenDeltas.push([q.defuse_asset_identifier_in, -amountIn])
    tokenDeltas.push([q.defuse_asset_identifier_out, amountOut])

    quoteHashes.push(q.quote_hash)
  }

  const fillStatus =
    quoteHashes.length === 0
      ? "NONE"
      : quoteHashes.length === quotes.length
        ? "FULL"
        : "PARTIAL"

  switch (fillStatus) {
    case "NONE": {
      if (anyQuoteError != null) {
        return {
          tag: "err",
          value: anyQuoteError,
        }
      }

      return {
        tag: "err",
        value: {
          type: "NO_QUOTES",
        },
      }
    }

    case "FULL":
    case "PARTIAL": {
      return {
        tag: "ok",
        value: {
          quoteHashes,
          expirationTime: new Date(
            expirationTime === Number.POSITIVE_INFINITY ? 0 : expirationTime
          ).toISOString(),
          tokenDeltas,
        },
      }
    }

    default:
      fillStatus satisfies never
      throw new Error("exhaustive check failed")
  }
}

async function fetchQuotesForTokens(
  tokenOut: string,
  amountsToQuote: Record<string, bigint>,
  waitMs: number,
  {
    logBalanceSufficient,
    signal,
  }: {
    logBalanceSufficient: boolean
    signal?: AbortSignal
  }
): Promise<null | NonNullable<QuoteResults>[]> {
  const quotes = await Promise.all(
    Object.entries(amountsToQuote).map(async ([tokenIn, amountIn]) => {
      return quoteWithLog(
        {
          defuse_asset_identifier_in: tokenIn,
          defuse_asset_identifier_out: tokenOut,
          exact_amount_in: amountIn.toString(),
          min_deadline_ms: settings.quoteMinDeadlineMs,
          wait_ms: waitMs,
        },
        {
          fetchOptions: { signal },
          logBalanceSufficient,
        }
      )
    })
  )

  return ensureAllNonNull(quotes)
}

function ensureAllNonNull<T>(array: (T | null)[]): T[] | null {
  const filtered = array.filter((x): x is T => x !== null)
  return filtered.length === array.length ? filtered : null
}

export async function quoteWithLog(
  params: Parameters<typeof quote>[0],
  {
    logBalanceSufficient,
    ...config
  }: { logBalanceSufficient: boolean } & Parameters<typeof quote>[1]
) {
  const result = await quote(params, config)
  if (result == null) {
    logger.warn("quote: No liquidity available", { quoteParams: params })

    if (
      logBalanceSufficient &&
      // We don't care about fast quotes, since they fail often
      (params.wait_ms == null || params.wait_ms > 1000)
    ) {
      logger.warn(
        "quote: No liquidity available for user with sufficient balance",
        { quoteParams: params }
      )
    }
  }
  return result
}
