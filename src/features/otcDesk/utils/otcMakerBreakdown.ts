import type { TokenValue } from "../../../types/base"
import {
  grossUpAmount,
  netDownAmount,
  subtractAmounts,
} from "../../../utils/tokenUtils"
import type { TradeBreakdown } from "../types/sharedTypes"

export function computeTradeBreakdown(params: {
  amountIn: TokenValue
  amountOut: TokenValue
  protocolFee: number
}): TradeBreakdown {
  const takerSends = {
    amount: grossUpAmount(params.amountOut.amount, params.protocolFee),
    decimals: params.amountOut.decimals,
  }
  const takerReceives = {
    amount: netDownAmount(params.amountIn.amount, params.protocolFee),
    decimals: params.amountIn.decimals,
  }

  return {
    makerSends: params.amountIn,
    makerReceives: params.amountOut,
    makerPaysFee: subtractAmounts(params.amountIn, takerReceives),
    takerSends,
    takerReceives,
    takerPaysFee: subtractAmounts(takerSends, params.amountOut),
  }
}
