import { assert } from "src/utils/assert"
import { computeTotalBalanceDifferentDecimals } from "src/utils/tokenUtils"
import type { ActorRefFrom } from "xstate"
import type { BalanceMapping } from "../features/machines/depositedBalanceMachine"
import type { Events as IntentPoolEvents } from "../features/machines/intentPoolMachine"
import type { intentStatusMachine } from "../features/machines/intentStatusMachine"

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
    const tokenDeltas = intent.intentOperationParams.quote?.tokenDeltas
    if (tokenDeltas === undefined || tokenDeltas.length === 0) {
      continue
    }

    const [_, amount] = tokenDeltas[0] as [string, bigint]
    if (amount === undefined) {
      continue
    }
    // Multiply amount by -1n because the amount is negative
    if (onchainBalance.amount < amount * -1n) {
      continue
    }
    return intentRef.id
  }
  return null
}
