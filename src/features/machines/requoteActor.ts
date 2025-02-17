import { type ActorRefFrom, fromPromise } from "xstate"
import type { AggregatedQuote, QuoteResult } from "../../services/quoteService"
import type {
  QuoteInput,
  backgroundQuoterMachine,
} from "./backgroundQuoterMachine"
import type { BalanceMapping } from "./depositedBalanceMachine"
import type {
  IntentDescription,
  IntentOperationParams,
} from "./intentSignMachine"

export type QuoteParams = {
  intentDescription: IntentDescription
  intentOperationParams: IntentOperationParams
  balances: BalanceMapping
}

export type RequoteOutput =
  | {
      tag: "ok"
      value: AggregatedQuote
    }
  | {
      tag: "err"
      value: { reason: "ERR_REQUOTE_FAILED" }
    }

export const requoteActor = fromPromise(
  ({
    input,
  }: {
    input: Parameters<typeof prepareNewQuote>[0]
  }) => {
    return prepareNewQuote(input)
  }
)

async function prepareNewQuote({
  quoteParams,
  backgroundQuoteRef,
}: {
  quoteParams: QuoteParams
  backgroundQuoteRef: ActorRefFrom<typeof backgroundQuoterMachine>
}): Promise<RequoteOutput> {
  let params: QuoteInput
  if (
    quoteParams.intentOperationParams.type === "swap" &&
    quoteParams.intentDescription.type === "swap"
  ) {
    params = {
      tokensIn: quoteParams.intentOperationParams.tokensIn,
      tokenOut: quoteParams.intentOperationParams.tokenOut,
      amountIn: quoteParams.intentDescription.totalAmountIn,
      balances: quoteParams.balances,
    }
  }
  if (quoteParams.intentDescription.type === "withdraw") {
    // TODO: Provide correct params if we want to requote withdraw
    return {
      tag: "err",
      value: { reason: "ERR_REQUOTE_FAILED" },
    }
  }

  const swapQuote = await new Promise<QuoteResult>((resolve) => {
    backgroundQuoteRef.send({
      type: "NEW_QUOTE_INPUT",
      params,
    })

    const sub = backgroundQuoteRef.on("NEW_QUOTE", (event) => {
      sub.unsubscribe()
      resolve(event.params.quote)
    })
  })

  if (swapQuote.tag === "err") {
    return {
      tag: "err",
      value: { reason: "ERR_REQUOTE_FAILED" },
    }
  }

  return {
    tag: "ok",
    value: swapQuote.value,
  }
}
