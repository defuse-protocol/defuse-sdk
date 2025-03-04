export { DepositWidget } from "./features/deposit/components/DepositWidget"
export { SwapWidget } from "./features/swap/components/SwapWidget"
export { WithdrawWidget } from "./features/withdraw/components/WithdrawWidget"
export { OtcMakerWidget } from "./features/otcDesk/components/OtcMakerWidget"
export { OtcTakerWidget } from "./features/otcDesk/components/OtcTakerWidget"
export { GiftMakerWidget } from "./features/gift/components/GiftMakerWidget"
export { GiftTakerWidget } from "./features/gift/components/GiftTakerWidget"
export type { BaseTokenInfo, UnifiedTokenInfo } from "./types/base"
export { ChainType } from "./types/deposit"
export { isBaseToken, isUnifiedToken } from "./utils/token"

// Message creation utilities
export {
  createEmptyIntentMessage,
  createSwapIntentMessage,
  createWithdrawIntentMessage,
} from "./core/messages"
export type {
  IntentMessageConfig,
  WithdrawIntentMessageConfig,
} from "./core/messages"

// Protocol formatters
export {
  formatSignedIntent,
  formatUserIdentity,
  type DefuseUserId,
  type SignerCredentials,
} from "./core/formatters"
