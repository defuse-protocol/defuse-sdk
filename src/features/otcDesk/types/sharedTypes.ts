import type { TokenValue } from "../../../types/base"
import type { WalletMessage, WalletSignatureResult } from "../../../types/swap"

export type SignMessage = (
  params: WalletMessage
) => Promise<WalletSignatureResult | null>

export type TradeBreakdown = {
  makerSends: TokenValue
  makerReceives: TokenValue
  makerPaysFee: TokenValue
  takerSends: TokenValue
  takerReceives: TokenValue
  takerPaysFee: TokenValue
}
