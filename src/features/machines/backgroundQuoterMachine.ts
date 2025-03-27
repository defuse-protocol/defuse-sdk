import { type ActorRef, type Snapshot, fromCallback } from "xstate"
import { logger } from "../../logger"
import { type QuoteResult, queryQuote } from "../../services/quoteService"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../types/base"
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

const QUOTE_TIMINGS = [
  {
    auctionTimeMs: 500, // for fast quotes
    intervalMs: -1, // means no polling
    timeoutMs: 15000,
  },
  {
    auctionTimeMs: 2000, // normal solvers
    intervalMs: 10000,
    timeoutMs: 15000,
  },
  {
    auctionTimeMs: 10000, // MPC solvers
    intervalMs: 10000,
    timeoutMs: 20000,
  },
]

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

function pollQuote(
  signal: AbortSignal,
  quoteInput: QuoteInput,
  onResult: (result: QuoteResult) => void
): void {
  for (const timings of QUOTE_TIMINGS) {
    pollQuoteLoop({
      signal,
      quoteInput,
      onResult,
      ...timings,
    }).catch((error) =>
      logger.error(
        new Error("pollQuote terminated unexpectedly", { cause: error })
      )
    )
  }
}

async function pollQuoteLoop({
  signal,
  quoteInput,
  auctionTimeMs,
  intervalMs,
  timeoutMs,
  onResult,
}: {
  signal: AbortSignal
  quoteInput: QuoteInput
  auctionTimeMs: number
  intervalMs: number
  timeoutMs: number
  onResult: (result: QuoteResult) => void
}): Promise<void> {
  let lastPropagatedResultRequestedAt: number | null = null

  while (!signal.aborted) {
    const requestedAt = Date.now()

    queryQuote(
      {
        tokensIn: getUnderlyingBaseTokenInfos(
          "tokensIn" in quoteInput ? quoteInput.tokensIn : quoteInput.tokenIn
        ),
        tokenOut: quoteInput.tokenOut,
        amountIn: quoteInput.amountIn,
        balances: quoteInput.balances,
        waitMs: auctionTimeMs,
      },
      {
        signal: AbortSignal.timeout(timeoutMs),
      }
    ).then(
      (quote) => {
        // Don't propagate results if polling was cancelled
        if (signal.aborted) return

        if (
          // We're interested in the latest result only
          lastPropagatedResultRequestedAt == null ||
          lastPropagatedResultRequestedAt < requestedAt
        ) {
          lastPropagatedResultRequestedAt = requestedAt
          onResult(quote)
        }
      },
      (e) => {
        if (isTimedOut(e)) {
          logger.info("Timeout querying quote", { quoteInput })
        } else {
          logger.error(e, { quoteInput })
        }
      }
    )

    if (intervalMs < 0) {
      break
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

function isTimedOut(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "TimeoutError") {
    return true
  }

  if (e instanceof Error) {
    return isTimedOut(e.cause)
  }

  return false
}
