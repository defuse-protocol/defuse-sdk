import { BaseError } from "../../../errors/base"
import type { TokenValue } from "../../../types/base"

export class AmountMismatchError extends BaseError {
  constructor(requested: TokenValue, remaining: TokenValue) {
    super("Unable to fulfill requested amount", {
      details: `Unable to fulfill requested amount ${requested.amount} (decimals: ${requested.decimals}) with remaining amount ${remaining.amount} (decimals: ${remaining.decimals})`,
    })
    this.name = "AmountMismatchError"
  }
}
