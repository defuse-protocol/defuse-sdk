import { settings } from "../../constants/settings"
import type { BaseTokenInfo, TokenValue } from "../../types/base"
import { assert } from "../../utils/assert"
import {
  adjustDecimals,
  compareAmounts,
  computeTotalBalanceDifferentDecimals,
} from "../../utils/tokenUtils"
import { AggregatedQuoteError, QuoteError } from "./errors/quote"
import {
  type GetQuoteParams,
  type GetQuoteReturnType,
  getQuote,
} from "./getQuote"
import type { JSONRPCErrorType } from "./solverRelayHttpClient/types"
import type { AggregatedQuote } from "./types/quote"
import {
  type AmountMismatchError,
  calculateSplitAmounts,
} from "./utils/calculateSplitAmounts"

type TokenSlice = BaseTokenInfo

export interface GetAggregatedExactInQuoteParams {
  tokensIn: TokenSlice[] // set of close tokens, e.g. [USDC on Solana, USDC on Ethereum, USDC on Near]
  tokenOut: TokenSlice // set of close tokens, e.g. [USDC on Solana, USDC on Ethereum, USDC on Near]
  amountIn: TokenValue // total amount in
  balances: Record<string, bigint> // how many tokens of each type are available
  waitMs: number
}

export type GetAggregatedQuoteExactInReturnType = AggregatedQuote
export type GetAggregatedQuoteExactInErrorType =
  | JSONRPCErrorType
  | AggregatedQuoteError
  | AmountMismatchError

export async function getAggregatedQuoteExactIn({
  aggregatedQuoteParams,
  config = {},
}: {
  aggregatedQuoteParams: GetAggregatedExactInQuoteParams
  config?: Omit<GetQuoteParams["config"], "logBalanceSufficient">
}): Promise<GetAggregatedQuoteExactInReturnType> {
  const tokenOut = aggregatedQuoteParams.tokenOut
  const tokenIn = aggregatedQuoteParams.tokensIn[0]
  assert(tokenIn != null, "tokensIn is empty")

  const totalAvailableIn = computeTotalBalanceDifferentDecimals(
    aggregatedQuoteParams.tokensIn,
    aggregatedQuoteParams.balances
  )

  // If total available is less than requested, just quote the full amount from one token
  if (
    totalAvailableIn == null ||
    compareAmounts(totalAvailableIn, aggregatedQuoteParams.amountIn) === -1
  ) {
    const exactAmountIn: bigint = adjustDecimals(
      aggregatedQuoteParams.amountIn.amount,
      aggregatedQuoteParams.amountIn.decimals,
      tokenIn.decimals
    )
    const quoteParams: GetQuoteParams["quoteParams"] = {
      defuse_asset_identifier_in: tokenIn.defuseAssetId,
      defuse_asset_identifier_out: tokenOut.defuseAssetId,
      exact_amount_in: exactAmountIn.toString(),
      min_deadline_ms: settings.quoteMinDeadlineMs,
      wait_ms: aggregatedQuoteParams.waitMs,
    }
    const q = getQuote({
      quoteParams,
      config: {
        ...config,
        logBalanceSufficient: false,
      },
    })

    return {
      ...aggregateQuotes(await Promise.allSettled([q]), [quoteParams]),
      isSimulation: true,
    }
  }

  const amountsToQuote = calculateSplitAmounts(
    aggregatedQuoteParams.tokensIn,
    aggregatedQuoteParams.amountIn,
    aggregatedQuoteParams.balances
  )

  const { quotes, quoteParams } = await fetchQuotesForTokens(
    tokenOut.defuseAssetId,
    amountsToQuote,
    aggregatedQuoteParams.waitMs,
    {
      ...config,
      logBalanceSufficient: true,
    }
  )

  return aggregateQuotes(quotes, quoteParams)
}

export function aggregateQuotes(
  quotes: PromiseSettledResult<GetQuoteReturnType>[],
  quoteParams: GetQuoteParams["quoteParams"][]
): AggregatedQuote {
  const quoteHashes: string[] = []
  let expirationTime = Number.POSITIVE_INFINITY
  const tokenDeltas: [string, bigint][] = []
  const validQuoteParams: GetQuoteParams["quoteParams"][] = []
  const quoteErrors: QuoteError[] = []

  for (const [i, quoteResult] of quotes.entries()) {
    if (quoteResult.status === "rejected") {
      if (quoteResult.reason instanceof QuoteError) {
        quoteErrors.push(quoteResult.reason)
      } else {
        throw quoteResult.reason
      }
      continue
    }

    const quote = quoteResult.value
    const amountOut = BigInt(quote.amount_out)
    const amountIn = BigInt(quote.amount_in)

    expirationTime = Math.min(
      expirationTime,
      new Date(quote.expiration_time).getTime()
    )

    tokenDeltas.push([quote.defuse_asset_identifier_in, -amountIn])
    tokenDeltas.push([quote.defuse_asset_identifier_out, amountOut])

    quoteHashes.push(quote.quote_hash)

    const currQuoteParams = quoteParams[i]
    assert(currQuoteParams != null)
    validQuoteParams.push(currQuoteParams)
  }

  if (quoteHashes.length === 0) {
    throw new AggregatedQuoteError({ errors: quoteErrors })
  }

  let aggregatedQuote: AggregatedQuote = {
    quoteHashes,
    expirationTime: new Date(
      expirationTime === Number.POSITIVE_INFINITY ? 0 : expirationTime
    ).toISOString(),
    tokenDeltas,
    quoteParams: validQuoteParams,
    isSimulation: false,
    fillStatus: "FULL",
  }

  if (quoteErrors.length > 0) {
    aggregatedQuote = {
      ...aggregatedQuote,
      fillStatus: "PARTIAL",
      quoteErrors: quoteErrors,
    }
  }

  return aggregatedQuote
}

async function fetchQuotesForTokens(
  tokenOut: string,
  amountsToQuote: Record<string, bigint>,
  waitMs: number,
  config: GetQuoteParams["config"]
): Promise<{
  quotes: PromiseSettledResult<GetQuoteReturnType>[]
  quoteParams: GetQuoteParams["quoteParams"][]
}> {
  const quoteParams = Object.entries(amountsToQuote).map(
    ([tokenIn, amountIn]): GetQuoteParams["quoteParams"] => {
      return {
        defuse_asset_identifier_in: tokenIn,
        defuse_asset_identifier_out: tokenOut,
        exact_amount_in: amountIn.toString(),
        min_deadline_ms: settings.quoteMinDeadlineMs,
        wait_ms: waitMs,
      }
    }
  )

  const quotes = await Promise.allSettled(
    quoteParams.map((quoteParams) => getQuote({ quoteParams, config }))
  )

  return { quotes, quoteParams }
}
