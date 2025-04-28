import type { SnapshotFrom } from "xstate"
import type { WithdtrawalFee } from "../../../../services/withdrawService"
import type { TokenValue } from "../../../../types/base"
import type { withdrawUIMachine } from "../../../machines/withdrawUIMachine"

export function isLiquidityUnavailableSelector(
  state: SnapshotFrom<typeof withdrawUIMachine>
): boolean {
  return (
    state.context.preparationOutput?.tag === "err" &&
    state.context.preparationOutput.value.reason === "NO_QUOTES"
  )
}
export function isUnsufficientTokenInAmount(
  state: SnapshotFrom<typeof withdrawUIMachine>
): boolean {
  return (
    state.context.preparationOutput?.tag === "err" &&
    state.context.preparationOutput.value.reason === "INSUFFICIENT_AMOUNT"
  )
}

/**
 * @return null | TokenValue - null if not enough info to determine
 */
export function totalAmountReceivedSelector(
  state: SnapshotFrom<typeof withdrawUIMachine>
): TokenValue | null {
  if (
    state.context.preparationOutput == null ||
    state.context.preparationOutput.tag !== "ok"
  ) {
    return null
  }

  return state.context.preparationOutput.value.receivedAmount
}

/**
 * @return amount 0, decimals 0 | TokenValue if not enough info to determine
 */
export function withdtrawalFeeSelector(
  state: SnapshotFrom<typeof withdrawUIMachine>
): WithdtrawalFee {
  if (
    state.context.preparationOutput == null ||
    state.context.preparationOutput.tag !== "ok"
  ) {
    return {
      tag: "ok",
      value: {
        amount: BigInt(0),
        decimals: 0,
      },
    }
  }

  return state.context.preparationOutput.value.withdtrawalFee
}
