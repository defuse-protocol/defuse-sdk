import type { SendNearTransaction } from "../features/machines/publicKeyVerifierMachine"
import type { AuthHandle } from "./authHandle"
import type { BaseTokenInfo, UnifiedTokenInfo } from "./base"
import type { RenderHostAppLink } from "./hostAppLink"
import type { WalletMessage, WalletSignatureResult } from "./walletMessage"

export type LastLiquidityCheckStatus = "passed" | "failed"

export type MaxLiquidityInJson = {
  validatedAmount: {
    value: string
    __type?: string
  }
  amount: {
    value: string
    __type?: string
  }
  lastStepSize?: {
    value: string
    __type?: string
  }
  lastLiquidityCheck?: LastLiquidityCheckStatus
}

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

  /**
   * Solver's max liquidity data per address pairs addr1#addr2 = liquidity data
   */
  liquidityData?: Record<string, MaxLiquidityInJson> | null
}
