import { type ActorRef, type Snapshot, fromCallback } from "xstate"
import { logger } from "../../logger"
import {
  type AggregatedQuoteParams,
  type QuoteResult,
  queryQuote,
} from "../../services/quoteService"
import { FetchError } from "../../services/solverRelayHttpClient/runtime"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../types/base"
import { findError } from "../../utils/errors"
import { getUnderlyingBaseTokenInfos } from "../../utils/tokenUtils"

export type QuoteInput =
  | {
      tokenIn: BaseTokenInfo | UnifiedTokenInfo
      tokenOut: BaseTokenInfo
      amountIn: { amount: bigint; decimals: number }
      balances: Record<BaseTokenInfo["defuseAssetId"], bigint>
    }
  | {
      tokensIn: Array<BaseTokenInfo>
      tokenOut: BaseTokenInfo
      amountIn: { amount: bigint; decimals: number }
      balances: Record<BaseTokenInfo["defuseAssetId"], bigint>
    }

export type Events =
  | {
      type: "NEW_QUOTE_INPUT"
      params: QuoteInput
    }
  | {
      type: "PAUSE"
    }

type EmittedEvents = {
  type: "NEW_QUOTE"
  params: {
    quoteInput: QuoteInput
    quote: QuoteResult
  }
}

export type ParentEvents = {
  type: "NEW_QUOTE"
  params: {
    quoteInput: QuoteInput
    quote: QuoteResult
  }
}
type ParentActor = ActorRef<Snapshot<unknown>, ParentEvents>

type Input = {
  parentRef: ParentActor
}

export const backgroundQuoterMachine = fromCallback<
  Events,
  Input,
  EmittedEvents
>(({ receive, input, emit }) => {
  let abortController = new AbortController()

  receive((event) => {
    abortController.abort()
    abortController = new AbortController()

    const eventType = event.type
    switch (eventType) {
      case "PAUSE":
        return
      case "NEW_QUOTE_INPUT": {
        const quoteInput = event.params

        pollQuote(abortController.signal, quoteInput, (quote) => {
          input.parentRef.send({
            type: "NEW_QUOTE",
            params: { quoteInput, quote },
          })
          emit({
            type: "NEW_QUOTE",
            params: { quoteInput, quote },
          })
        })
        break
      }
      default:
        eventType satisfies never
        logger.warn("Unhandled event type", { eventType })
    }
  })

  return () => {
    abortController.abort()
  }
})

const FAST_QUOTE_WAIT_MS = 500 // immediate price discovery
const NORMAL_QUOTE_WAIT_MS = 2000 // regular solvers
const SLOW_QUOTE_WAIT_MS = 10000 // MPC solvers

const QUOTE_POLLING_INTERVAL_MS = 5000

function pollQuote(
  signal: AbortSignal,
  quoteInput: QuoteInput,
  onResult: (result: QuoteResult) => void
): void {
  let lastQuoteIndex = 0

  getQuotes({
    signal,
    quoteParams: {
      tokensIn: getUnderlyingBaseTokenInfos(
        "tokensIn" in quoteInput ? quoteInput.tokensIn : quoteInput.tokenIn
      ),
      tokenOut: quoteInput.tokenOut,
      amountIn: quoteInput.amountIn,
      balances: quoteInput.balances,
    },
    onResult: ({ requestId, result }) => {
      // Often the fast quote (#1) fails with "no quote".
      // But it doesn't mean that there's no quote at all.
      // It means Solvers couldn't provide a quote in a short time.
      // So we ignore this error and wait for the next quote.
      if (
        requestId === 1 &&
        result.tag === "err" &&
        result.value.type === "NO_QUOTES"
      ) {
        return
      }

      // We're interested in the latest result only
      if (lastQuoteIndex < requestId) {
        lastQuoteIndex = requestId
        onResult(result)
      }
    },
    onError: (error) => {
      // Ignore the error if the quote was cancelled
      if (!findError(error, FetchError)) {
        logger.error(error)
      }
    },
  })
}

function getQuotes({
  signal,
  quoteParams,
  onResult,
  onError,
}: {
  signal: AbortSignal
  quoteParams: Omit<AggregatedQuoteParams, "waitMs">
  onResult: (arg: { result: QuoteResult; requestId: number }) => void
  onError: (error: unknown) => void
}) {
  const queryQuote = queryQuoteWithRequestId()

  queryQuote({ ...quoteParams, waitMs: FAST_QUOTE_WAIT_MS }, { signal }).then(
    onResult,
    onError
  )

  queryQuote({ ...quoteParams, waitMs: NORMAL_QUOTE_WAIT_MS }, { signal }).then(
    onResult,
    onError
  )

  queryQuote({ ...quoteParams, waitMs: SLOW_QUOTE_WAIT_MS }, { signal }).then(
    onResult,
    onError
  )

  const timer = setInterval(() => {
    queryQuote({ ...quoteParams, waitMs: SLOW_QUOTE_WAIT_MS }, { signal }).then(
      onResult,
      onError
    )
  }, QUOTE_POLLING_INTERVAL_MS)

  signal.addEventListener("abort", () => {
    clearInterval(timer)
  })
}

function queryQuoteWithRequestId() {
  let requestId = 0
  return async (...args: Parameters<typeof queryQuote>) => {
    const currentRequestId = ++requestId
    const result = await queryQuote(...args)
    return { requestId: currentRequestId, result }
  }
}
