import { type ActorRef, type Snapshot, fromCallback } from "xstate"
import { settings } from "../../config/settings"
import { logger } from "../../logger"
import { type AggregatedQuote, queryQuote } from "../../services/quoteService"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../types/base"
import { isBaseToken } from "../../utils/token"

export type QuoteInput =
  | {
      tokenIn: BaseTokenInfo | UnifiedTokenInfo
      tokenOut: BaseTokenInfo | UnifiedTokenInfo
      amountIn: bigint
      balances: Record<BaseTokenInfo["defuseAssetId"], bigint>
    }
  | {
      tokensIn: Array<BaseTokenInfo>
      tokenOut: BaseTokenInfo
      amountIn: bigint
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

export type EmittedEvents = {
  type: "NEW_QUOTE"
  params: {
    quoteInput: QuoteInput
    quote: AggregatedQuote
  }
}

export type ParentEvents = {
  type: "NEW_QUOTE"
  params: {
    quoteInput: QuoteInput
    quote: AggregatedQuote
  }
}
type ParentActor = ActorRef<Snapshot<unknown>, ParentEvents>

type Input = {
  parentRef: ParentActor
  delayMs: number
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

        pollQuote(
          abortController.signal,
          quoteInput,
          input.delayMs,
          (quote) => {
            input.parentRef.send({
              type: "NEW_QUOTE",
              params: { quoteInput, quote },
            })
            emit({
              type: "NEW_QUOTE",
              params: { quoteInput, quote },
            })
          }
        )
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
  delayMs: number,
  onResult: (result: AggregatedQuote) => void
): void {
  pollQuoteLoop(signal, quoteInput, delayMs, onResult).catch((error) =>
    logger.error(
      new Error("pollQuote terminated unexpectedly", { cause: error })
    )
  )
}

async function pollQuoteLoop(
  signal: AbortSignal,
  quoteInput: QuoteInput,
  delayMs: number,
  onResult: (result: AggregatedQuote) => void
): Promise<void> {
  let lastPropagatedResultRequestedAt: number | null = null

  while (!signal.aborted) {
    const requestedAt = Date.now()

    queryQuote(
      {
        tokensIn: getUnderlyingDefuseAssetIds(
          "tokensIn" in quoteInput ? quoteInput.tokensIn : [quoteInput.tokenIn]
        ),
        tokensOut: getUnderlyingDefuseAssetIds([quoteInput.tokenOut]),
        amountIn: quoteInput.amountIn,
        balances: quoteInput.balances,
      },
      {
        signal: AbortSignal.timeout(settings.quoteQueryTimeoutMs),
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
        if (!isTimedOut(e)) {
          logger.info("Timeout querying quote", { quoteInput })
        } else {
          logger.error(e, { quoteInput })
        }
      }
    )

    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
}

function getUnderlyingDefuseAssetIds(
  tokens: Array<BaseTokenInfo | UnifiedTokenInfo>
): BaseTokenInfo["defuseAssetId"][] {
  return tokens.flatMap((token) => {
    return isBaseToken(token)
      ? [token.defuseAssetId]
      : token.groupedTokens.map((token) => token.defuseAssetId)
  })
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
