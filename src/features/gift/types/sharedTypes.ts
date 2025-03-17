import type { WalletMessage, WalletSignatureResult } from "../../../types/swap"

export type SignMessage = (
  params: WalletMessage
) => Promise<WalletSignatureResult | null>

export type GiftPayload = {
  secretKey: string
  message: string
}
