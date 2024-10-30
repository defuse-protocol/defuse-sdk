import type { BaseTokenInfo, UnifiedTokenInfo } from "./base"
import type { WalletMessage, WalletSignatureResult } from "./swap"

export type WithdrawWidgetProps = {
  accountId: string | undefined
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
  signMessage: (params: WalletMessage) => Promise<WalletSignatureResult | null>
}
