import type { QuoteResult } from "src/services/quoteService"
import { type ActorRefFrom, fromPromise } from "xstate"
import type {
  QuoteInput,
  backgroundQuoterMachine,
} from "./backgroundQuoterMachine"
import type { BalanceMapping } from "./depositedBalanceMachine"
import type { IntentDescription } from "./intentSignMachine"

export type QuoteParams = {
  intentDescription: IntentDescription
  balances: BalanceMapping
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
}): Promise<QuoteResult | null> {
  let quote: null | QuoteResult = null

  let params: QuoteInput
  if (quoteParams.intentDescription.type === "swap") {
    throw new Error("Not implemented")
    // biome-ignore lint/correctness/noUnreachable: <explanation>
    params = {} as QuoteInput
  }
  if (quoteParams.intentDescription.type === "withdraw") {
    throw new Error("Not implemented")
    // biome-ignore lint/correctness/noUnreachable: <explanation>
    params = {} as QuoteInput
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

  quote = swapQuote

  if (quote && quote.tag === "err") {
    return quote
  }

  return quote
}
