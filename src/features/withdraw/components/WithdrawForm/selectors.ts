import type { SnapshotFrom } from "xstate"
import type { withdrawUIMachine } from "../../../machines/withdrawUIMachine"

export function isLiquidityUnavailableSelector(
  state: SnapshotFrom<typeof withdrawUIMachine>
): boolean {
  return (
    state.context.preparationOutput?.tag === "err" &&
    state.context.preparationOutput.value.reason === "ERR_EMPTY_QUOTE"
  )
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
