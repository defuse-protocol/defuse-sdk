import type { SignerCredentials } from "../../../core/formatters"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import type { WalletMessage, WalletSignatureResult } from "../../../types/swap"

export type SignMessage = (
  params: WalletMessage
) => Promise<WalletSignatureResult | null>

export type GiftPayload = {
  secretKey: string
  message: string
}

export type GiftSignedResult = {
  giftId: string
  multiPayload: MultiPayload
  signerCredentials: SignerCredentials
  signatureResult: WalletSignatureResult
}
