import { assert } from "src/utils/assert"
import { computeTotalBalanceDifferentDecimals } from "src/utils/tokenUtils"
import type { ActorRefFrom } from "xstate"
import type { BalanceMapping } from "../features/machines/depositedBalanceMachine"
import type { Events as IntentPoolEvents } from "../features/machines/intentPoolMachine"
import type { intentStatusMachine } from "../features/machines/intentStatusMachine"
import type { TokenValue } from "../types/base"
import type { AggregatedQuote } from "./quoteService"

export function findExecutableIntentRef(
  intentRefs: ActorRefFrom<typeof intentStatusMachine>[],
  pool: Map<string, IntentPoolEvents["params"]>,
  balances: BalanceMapping
): string | null {
  for (const intentRef of intentRefs) {
    const { value } = intentRef.getSnapshot()
    // Any other state means either the intent is already executing or has been executed
    if (value !== "pending") {
      continue
    }
    const intent = pool.get(intentRef.id)
    assert(intent !== undefined, "intent is undefined")

    const onchainBalance = computeTotalBalanceDifferentDecimals(
      intentRef.getSnapshot().context.tokenIn,
      balances
    )

    if (onchainBalance === undefined) {
      continue
    }

    const intentType = intent.intentOperationParams.type
    switch (intentType) {
      case "withdraw": {
        const directWithdrawalAmount =
          intent.intentOperationParams.directWithdrawalAmount
        if (onchainBalance.amount < directWithdrawalAmount.amount) {
          continue
        }
        const quote = intent.intentOperationParams.quote
        if (quote) {
          if (!hasEnoughBalanceForQuote(quote, onchainBalance)) {
            continue
          }
        }
        return intentRef.id
      }
      case "swap": {
        const quote = intent.intentOperationParams.quote
        if (quote === null) {
          continue
        }
        if (!hasEnoughBalanceForQuote(quote, onchainBalance)) {
          continue
        }
        return intentRef.id
      }
      default:
        intentType satisfies never
        throw new Error("exhaustive check failed")
    }
  }

  return null
}

function hasEnoughBalanceForQuote(
  quote: AggregatedQuote,
  onchainBalance: TokenValue
) {
  const tokenDeltas = quote.tokenDeltas
  if (tokenDeltas.length === 0) {
    return false
  }
  const firstTokenDelta = tokenDeltas[0]
  if (!firstTokenDelta) {
    return false
  }
  const [_, amount] = firstTokenDelta
  // First token delta amount is always negative since it represents the token being spent
  // so that we have to multiply it by -1n to get the absolute value
  if (onchainBalance.amount < amount * -1n) {
    return false
  }
  return true
}
