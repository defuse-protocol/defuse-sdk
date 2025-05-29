import type { SignerCredentials } from "../../../core/formatters"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import type {
  WalletMessage,
  WalletSignatureResult,
} from "../../../types/walletMessage"

export type SignMessage = (
  params: WalletMessage
) => Promise<WalletSignatureResult | null>

export type GiftLinkData = {
  secretKey: string
  message: string
}

export type GiftSignedResult = {
  multiPayload: MultiPayload
  signerCredentials: SignerCredentials
  signatureResult: WalletSignatureResult
}

export type CreateGiftIntent = (
  payload: GiftLinkData
) => Promise<{ iv: string }>

export type GenerateLink = (giftId: string, iv: string) => string
