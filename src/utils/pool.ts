import type { ActorRefFrom } from "xstate"
import type { BalanceMapping } from "../features/machines/depositedBalanceMachine"
import type { Intent } from "../features/machines/intentPoolMachine"
import type { intentStatusMachine } from "../features/machines/intentStatusMachine"
import { assert } from "./assert"

export function isOptimisticIntent(
  requestedDeltaChanges: [string, bigint],
  onchainBalances: BalanceMapping
): boolean {
  const balance = onchainBalances[requestedDeltaChanges[0]]
  if (balance === undefined) {
    return false
  }
  return balance < requestedDeltaChanges[1] * -1n
}

export function getPendingDeltaBalances(
  intentRefs: ActorRefFrom<typeof intentStatusMachine>[],
  pool: Map<string, Intent>
): BalanceMapping {
  const deltas: Record<string, bigint> = {}

  for (const intentRef of intentRefs) {
    const { value } = intentRef.getSnapshot()
    if (value !== "pending") continue

    const intent = pool.get(intentRef.id)
    assert(intent !== undefined, "intent is undefined")
    const tokenDeltas = intent.quoteToPublish?.tokenDeltas
    assert(tokenDeltas !== undefined, "tokenDeltas is undefined")

    for (const [key, value] of tokenDeltas) {
      if (deltas[key] !== undefined) {
        deltas[key] += value
      } else {
        deltas[key] = value
      }
    }
  }

  return deltas
}
