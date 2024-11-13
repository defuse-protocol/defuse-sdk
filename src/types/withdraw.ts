import type { SendNearTransaction } from "../features/machines/publicKeyVerifierMachine"
import type { BaseTokenInfo, UnifiedTokenInfo } from "./base"
import type { UserInfo } from "./deposit"
import type { WalletMessage, WalletSignatureResult } from "./swap"

export type WithdrawWidgetProps = UserInfo & {
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
  signMessage: (params: WalletMessage) => Promise<WalletSignatureResult | null>
  sendNearTransaction: SendNearTransaction
}
