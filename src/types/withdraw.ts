import type { BaseTokenInfo, UnifiedTokenInfo } from "./base"
import type { WalletMessage, WalletSignatureResult } from "./swap"

export type WithdrawWidgetProps = {
  accountId: string
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
  signMessage: (params: WalletMessage) => Promise<WalletSignatureResult | null>
}
