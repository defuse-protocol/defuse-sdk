import type { SnapshotFrom } from "xstate"
import { isAggregatedQuoteEmpty } from "../../../../services/quoteService"
import type { withdrawUIMachine } from "../../../machines/withdrawUIMachine"

/**
 * @return null | boolean - null if not enough info to determine
 */
export function isLiquidityUnavailable(
  state: SnapshotFrom<typeof withdrawUIMachine>
): boolean | null {
  if (state.context.withdrawalSpec == null) {
    // No withdraw info
    return null
  }

  if (state.context.withdrawalSpec.swapParams != null) {
    if (state.context.quote == null) {
      // Swap is required, but no swap quote
      return null
    }
    if (isAggregatedQuoteEmpty(state.context.quote)) {
      return true
    }
  }

  if (state.context.withdrawalSpec.nep141StorageAcquireParams != null) {
    if (state.context.nep141StorageQuote == null) {
      // NEP141 storage is required, but no storage quote
      return null
    }
    if (isAggregatedQuoteEmpty(state.context.nep141StorageQuote)) {
      return true
    }
  }

  return false
}
