import type { TokenValue } from "../../../../types/base"

export interface TokenValueWithPrice extends TokenValue {
  price: number
}
