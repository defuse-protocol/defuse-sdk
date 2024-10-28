import type { WalletSignatureResult } from "../types"
import { prepareSwapSignedData } from "../utils/prepareBroadcastRequest"
import * as solverRelayClient from "./solverRelayHttpClient"
import type * as types from "./solverRelayHttpClient/types"

export async function submitIntent(
  signatureData: WalletSignatureResult,
  quoteHashes: string[]
) {
  // todo: retry on network error
  const result = await solverRelayClient.publishIntent({
    signed_data: prepareSwapSignedData(signatureData),
    quote_hashes: quoteHashes,
  })
  // todo: check status, it may be "FAILED"
  return result.intent_hash
}

export type IntentSettlementResult = Awaited<
  ReturnType<typeof waitForIntentSettlement>
>

export async function waitForIntentSettlement(
  signal: AbortSignal,
  intentHash: string
) {
  let attempts = 0
  const MAX_INVALID_ATTEMPTS = 3 // ~600 ms of waiting

  let lastSeenResult: types.GetStatusResponse["result"] | null = null
  let txHash: string | null = null

  while (true) {
    signal.throwIfAborted()

    // todo: add retry in case of network error
    const res = await solverRelayClient.getStatus({
      intent_hash: intentHash,
    })

    const status = res.status
    switch (status) {
      case "PENDING":
        // Do nothing, just wait
        break

      case "TX_BROADCASTED":
        txHash = res.data.hash
        break

      case "SETTLED":
        return {
          status: "SETTLED" as const,
          txHash: res.data.hash,
          intentHash: res.intent_hash,
        }

      case "NOT_FOUND_OR_NOT_VALID": {
        if (
          // If previous status differs, we're sure new result is final
          (lastSeenResult != null && lastSeenResult.status !== res.status) ||
          // If we've seen only NOT_VALID and keep getting it then we should abort
          MAX_INVALID_ATTEMPTS <= ++attempts
        ) {
          return {
            status: "NOT_FOUND_OR_NOT_VALID" as const,
            txHash: txHash,
            intentHash: res.intent_hash,
          }
        }
        break
      }

      default:
        status satisfies never
    }

    lastSeenResult = res

    // Wait a bit before polling again
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

export function doesSignatureMatchUserAddress(
  signature: WalletSignatureResult | null,
  userAddress: string
) {
  if (signature == null) return false

  const signatureType = signature.type
  switch (signatureType) {
    case "NEP413":
      return (
        // For NEP-413, it's enough to ensure user didn't switch the account
        signature.signatureData.accountId === userAddress
      )
    case "EIP712":
      // For EIP-712, we need to derive the signer address from the signature
      throw new Error("EIP712 signature is not supported")
    default:
      signatureType satisfies never
      throw new Error("exhaustive check failed")
  }
}
