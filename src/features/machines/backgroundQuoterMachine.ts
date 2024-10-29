import { type ActorRef, type Snapshot, fromCallback } from "xstate"
import { settings } from "../../config/settings"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../types/base"
import { isBaseToken } from "../../utils"
import { type AggregatedQuote, queryQuote } from "./queryQuoteMachine"

export type QuoteInput = {
  tokenIn: BaseTokenInfo | UnifiedTokenInfo
  tokenOut: BaseTokenInfo | UnifiedTokenInfo
  amountIn: bigint
  balances: Record<BaseTokenInfo["defuseAssetId"], bigint>
}

type Events =
  | {
      type: "NEW_QUOTE_INPUT"
      params: QuoteInput
    }
  | {
      type: "PAUSE"
    }

export type ChildEvent = {
  type: "NEW_QUOTE"
  params: {
    quoteInput: QuoteInput
    quote: AggregatedQuote
  }
}
type ParentActor = ActorRef<Snapshot<unknown>, ChildEvent>

type Input = {
  parentRef: ParentActor
  delayMs: number
}

export const backgroundQuoterMachine = fromCallback<Events, Input>(
  ({ receive, input }) => {
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

          // todo: `NEW_QUOTE_INPUT` should not be emitted for 0 amounts, this is temporary fix
          if (quoteInput.amountIn === 0n) {
            return
          }

          pollQuote(
            abortController.signal,
            quoteInput,
            input.delayMs,
            (quote) => {
              input.parentRef.send({
                type: "NEW_QUOTE",
                params: { quoteInput, quote },
              })
            }
          )
          break
        }
        default:
          eventType satisfies never
          console.warn("Unhandled event type", { eventType })
      }
    })
  }
)

function pollQuote(
  signal: AbortSignal,
  quoteInput: QuoteInput,
  delayMs: number,
  onResult: (result: AggregatedQuote) => void
): void {
  pollQuoteLoop(signal, quoteInput, delayMs, onResult).catch((error) =>
    console.error("pollQuote terminated unexpectedly:", error)
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
        tokensIn: getUnderlyingDefuseAssetIds(quoteInput.tokenIn),
        tokensOut: getUnderlyingDefuseAssetIds(quoteInput.tokenOut),
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
        if (isTimedOut(e)) {
          console.error("Timeout querying quote", { quoteInput })
        } else {
          console.error("Error querying quote", e)
        }
      }
    )

    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
}

function getUnderlyingDefuseAssetIds(
  token: BaseTokenInfo | UnifiedTokenInfo
): BaseTokenInfo["defuseAssetId"][] {
  return isBaseToken(token)
    ? [token.defuseAssetId]
    : token.groupedTokens.map((token) => token.defuseAssetId)
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
