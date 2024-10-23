import type {
  SwappableToken,
  WalletMessage,
  WalletSignatureResult,
} from "./swap"

export type WithdrawWidgetProps = {
  accountId: string
  tokenList: SwappableToken[]
  signMessage: (params: WalletMessage) => Promise<WalletSignatureResult | null>
}
