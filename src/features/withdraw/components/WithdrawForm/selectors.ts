import type { SnapshotFrom } from "xstate"
import { isAggregatedQuoteEmpty } from "../../../../services/quoteService"
import type { withdrawUIMachine } from "../../../machines/withdrawUIMachine"

/**
 * @return null | boolean - null if not enough info to determine
 */
export function isLiquidityUnavailableSelector(
  state: SnapshotFrom<typeof withdrawUIMachine>
): boolean | null {
  if (
    state.context.preparationOutput == null ||
    state.context.preparationOutput.tag === "err"
  ) {
    // No withdraw info
    return null
  }

  const swap = state.context.preparationOutput.value.swap
  if (swap != null && isAggregatedQuoteEmpty(swap.swapQuote)) {
    return true
  }

  const nep141Storage = state.context.preparationOutput.value.nep141Storage
  if (
    nep141Storage != null &&
    nep141Storage.type === "swap_needed" &&
    isAggregatedQuoteEmpty(nep141Storage.quote)
  ) {
    return true
  }

  return false
}

/**
 * @return null | bigint - null if not enough info to determine
 */
export function totalAmountReceivedSelector(
  state: SnapshotFrom<typeof withdrawUIMachine>
): bigint | null {
  if (
    state.context.preparationOutput == null ||
    state.context.preparationOutput.tag !== "ok"
  ) {
    return null
  }

  return state.context.preparationOutput.value.receivedAmount
}
