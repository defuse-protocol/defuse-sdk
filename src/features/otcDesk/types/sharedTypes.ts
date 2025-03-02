import type { Result } from "@thames/monads"
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

// biome-ignore lint/suspicious/noExplicitAny: we need `any` here
export type ExtractOk<R extends Result<any, any>> = R extends Result<
  infer T,
  // biome-ignore lint/suspicious/noExplicitAny: we need `any` here
  any
>
  ? T
  : never

// biome-ignore lint/suspicious/noExplicitAny: we need `any` here
export type ExtractErr<R extends Result<any, any>> = R extends Result<
  // biome-ignore lint/suspicious/noExplicitAny: we need `any` here
  any,
  infer T
>
  ? T
  : never
