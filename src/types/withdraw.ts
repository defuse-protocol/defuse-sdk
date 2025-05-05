import { CHAIN_IDS } from "src/constants/evm"
import type { SendNearTransaction } from "../features/machines/publicKeyVerifierMachine"
import type { AuthHandle } from "./authHandle"
import type {
  BaseTokenInfo,
  SupportedChainName,
  UnifiedTokenInfo,
} from "./base"
import type { RenderHostAppLink } from "./hostAppLink"
import type { WalletMessage, WalletSignatureResult } from "./walletMessage"
export type WithdrawWidgetProps = {
  userAddress: AuthHandle["identifier"] | undefined
  chainType: AuthHandle["method"] | undefined
  presetTokenSymbol: string | undefined
  presetAmount: string | undefined
  presetRecipient: string | undefined
  presetNetwork: string | undefined
  renderHostAppLink: RenderHostAppLink
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
  signMessage: (params: WalletMessage) => Promise<WalletSignatureResult | null>
  sendNearTransaction: SendNearTransaction
  /**
   * Optional referral code, used for tracking purposes.
   * Prop is not reactive, set it once when the component is created.
   */
  referral?: string
}

export function isSupportedChainName(
  chainName: string
): chainName is SupportedChainName {
  const supportedChainNames = Object.keys(CHAIN_IDS)
  return supportedChainNames.includes(chainName)
}
