import { type ActorRef, type Snapshot, fromCallback } from "xstate"
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
  while (!signal.aborted) {
    const quote = await queryQuote({
      tokensIn: isBaseToken(quoteInput.tokenIn)
        ? [quoteInput.tokenIn.defuseAssetId]
        : quoteInput.tokenIn.groupedTokens.map((token) => token.defuseAssetId),
      tokensOut: isBaseToken(quoteInput.tokenOut)
        ? [quoteInput.tokenOut.defuseAssetId]
        : quoteInput.tokenOut.groupedTokens.map((token) => token.defuseAssetId),
      amountIn: quoteInput.amountIn,
      balances: quoteInput.balances,
    }).catch((e) => {
      console.error("Error querying quote", e)
      return null
    })

    if (quote == null || signal.aborted) {
      return
    }

    onResult(quote)

    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
}
