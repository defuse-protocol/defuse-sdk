import { fromPromise } from "xstate"
import { quote } from "../../services/solverRelayHttpClient"
import type { QuoteResponse } from "../../services/solverRelayHttpClient/types"

export interface Input {
  tokensIn: string[] // set of close tokens, e.g. [USDC on Solana", USDC on Ethereum, USDC on Near]
  tokensOut: string[] // set of close tokens, e.g. [USDC on Solana", USDC on Ethereum, USDC on Near]
  amountIn: bigint // total amount in
  balances: Record<string, bigint> // how many tokens of each type are available
}

export interface Output {
  quoteHashes: string[]
  expirationTime: number // earliest expiration time
  totalAmountIn: bigint
  totalAmountOut: bigint
  amountsIn: Record<string, bigint> // amount in for each token
  amountsOut: Record<string, bigint> // amount out for each token
}

type QuoteResults = QuoteResponse["result"]

/**
 * Machine to query quotes for a given input.
 * It also acts as a simple router when natively multichain assets are involved.
 */
export const queryQuoteMachine = fromPromise(
  async ({ input }: { input: Input }): Promise<Output> => queryQuote(input)
)

export async function queryQuote(input: Input): Promise<Output> {
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
    const q = await quote({
      defuse_asset_identifier_in: tokenIn,
      defuse_asset_identifier_out: tokenOut,
      amount_in: input.amountIn.toString(),
      min_deadline_ms: 120_000,
    })

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
    amountsToQuote
  )

  return aggregateQuotes(quotes)
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

export function aggregateQuotes(quotes: NonNullable<QuoteResults>[]): Output {
  let totalAmountIn = 0n
  let totalAmountOut = 0n
  const amountsIn: Record<string, bigint> = {}
  const amountsOut: Record<string, bigint> = {}
  const quoteHashes: string[] = []
  let expirationTime = Number.POSITIVE_INFINITY

  for (const qList of quotes) {
    const q = qList[0] // It is expected to be the best quote
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
  }
}

export async function fetchQuotesForTokens(
  tokensIn: string[],
  tokenOut: string,
  amountsToQuote: Record<string, bigint>
): Promise<NonNullable<QuoteResults>[]> {
  const quotes = await Promise.all(
    tokensIn.map(async (tokenIn) => {
      const amountIn = amountsToQuote[tokenIn]
      if (amountIn === undefined || amountIn === 0n) return null

      return quote({
        defuse_asset_identifier_in: tokenIn,
        defuse_asset_identifier_out: tokenOut,
        amount_in: amountIn.toString(),
        min_deadline_ms: 120_000,
      })
    })
  )

  return quotes.map(onlyValidQuotes)
}

function onlyValidQuotes(quotes: QuoteResults): NonNullable<QuoteResults> {
  if (quotes === null) return []
  return quotes.filter((q): q is NonNullable<typeof q> => q !== null)
}
