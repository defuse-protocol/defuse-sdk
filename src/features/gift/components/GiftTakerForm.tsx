import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { ChainType } from "../../../types/deposit"
import type { SendNearTransaction } from "../../machines/publicKeyVerifierMachine"
import type { SignMessage } from "../types/sharedTypes"

export type GiftTakerWidgetProps = {
  multiPayload: string

  /** List of available tokens for trading */
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]

  /** User's wallet address */
  userAddress: string | null | undefined
  userChainType: ChainType | null | undefined

  /** Sign message callback */
  signMessage: SignMessage

  /** Send NEAR transaction callback */
  sendNearTransaction: SendNearTransaction

  /** Theme selection */
  theme?: "dark" | "light"

  /** Frontend referral */
  referral?: string
}

// biome-ignore lint/correctness/noUnusedVariables: <explanation>
export function GiftTakerForm(props: GiftTakerWidgetProps) {
  return <div>test</div>
}
