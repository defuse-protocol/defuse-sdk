import type { walletMessage } from "@defuse-protocol/internal-utils"
import type { SendNearTransaction } from "../features/machines/publicKeyVerifierMachine"
import type { AuthHandle } from "./authHandle"
import type { BaseTokenInfo, UnifiedTokenInfo } from "./base"
import type { RenderHostAppLink } from "./hostAppLink"

export type WithdrawWidgetProps = {
  userAddress: AuthHandle["identifier"] | undefined
  chainType: AuthHandle["method"] | undefined
  presetTokenSymbol: string | undefined
  presetAmount: string | undefined
  presetRecipient: string | undefined
  presetNetwork: string | undefined
  renderHostAppLink: RenderHostAppLink
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
  signMessage: (
    params: walletMessage.WalletMessage
  ) => Promise<walletMessage.WalletSignatureResult | null>
  sendNearTransaction: SendNearTransaction
  /**
   * Optional referral code, used for tracking purposes.
   * Prop is not reactive, set it once when the component is created.
   */
  referral?: string
}
