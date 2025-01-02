import type { SendNearTransaction } from "../features/machines/publicKeyVerifierMachine"
import type { BaseTokenInfo, UnifiedTokenInfo } from "./base"
import type { ChainType } from "./deposit"

// Message for EVM wallets
export type ERC191Message = {
  message: string
}

export type ERC191SignatureData = {
  type: "ERC191"
  signatureData: string
  signedData: ERC191Message
}

// Message for NEAR wallets
export type NEP413Message = {
  message: string
  recipient: string
  nonce: Uint8Array
  callbackUrl?: string
}

export type NEP413SignatureData = {
  type: "NEP413"
  signatureData: {
    accountId: string
    /**
     * Base58-encoded signature with curve prefix. Example:
     * ed25519:Gxa24TGbJu4mqdhW3GbvLXmf4bSEyxVicrtpChDWbgga
     */
    publicKey: string
    /** Base64-encoded signature */
    signature: string
  }
  /**
   * The exact data that was signed. Wallet connectors may modify this during the signing process,
   * so this property contains the actual data that was signed by the wallet.
   */
  signedData: NEP413Message
}

// Message for Solana wallets
export type SolanaMessage = {
  message: Uint8Array
}

export type SolanaSignatureData = {
  type: "SOLANA"
  signatureData: Uint8Array
  signedData: SolanaMessage
}

export type WalletMessage = {
  ERC191: ERC191Message
  NEP413: NEP413Message
  SOLANA: SolanaMessage
}

export type WalletSignatureResult =
  | ERC191SignatureData
  | NEP413SignatureData
  | SolanaSignatureData

export type SwapEvent = {
  type: string
  data: unknown
  error?: string
}

export type SwappableToken = BaseTokenInfo | UnifiedTokenInfo

export type SwapWidgetProps = {
  theme?: "dark" | "light"
  tokenList: SwappableToken[]
  onEmit?: (event: SwapEvent) => void

  /**
   * The address (address for EVM, accountId for NEAR, etc) of the user performing the swap.
   * `null` if the user is not authenticated.
   */
  userAddress: string | null
  userChainType: ChainType | null

  sendNearTransaction: SendNearTransaction

  signMessage: (params: WalletMessage) => Promise<WalletSignatureResult | null>
  onSuccessSwap: (params: {
    amountIn: bigint
    amountOut: bigint
    tokenIn: SwappableToken
    tokenOut: SwappableToken
    txHash: string
    intentHash: string
  }) => void

  onNavigateDeposit?: () => void
  initialTokenIn?: SwappableToken
  initialTokenOut?: SwappableToken
}
