import type { ActorRefFrom } from "xstate"
import type { BalanceMapping } from "../features/machines/depositedBalanceMachine"
import type { Intent } from "../features/machines/intentPoolMachine"
import type { intentStatusMachine } from "../features/machines/intentStatusMachine"
import { assert } from "./assert"
import { accountSlippageExactIn } from "./tokenUtils"

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

    const intent: Intent | undefined = pool.get(intentRef.id)
    assert(intent !== undefined, "intent is undefined")
    assert(intent.quoteToPublish !== null, "quoteToPublish is null")

    // As we might get less token then expected, and due to fluctuation of the token price,
    // we apply slippage to the waiting intent to decrease operation amount of token befer
    // it's settled on chain
    const tokenDeltas = accountSlippageExactIn(
      intent.quoteToPublish.tokenDeltas,
      intent.slippageBasisPoints
    )

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
