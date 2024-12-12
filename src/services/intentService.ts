import type { ChainType, WalletSignatureResult } from "../types"
import { prepareSwapSignedData } from "../utils/prepareBroadcastRequest"
import * as solverRelayClient from "./solverRelayHttpClient"
import type * as types from "./solverRelayHttpClient/types"
export type PublishIntentFailureReason = "expired" | "internal"

export type PublishIntentResult =
  | { tag: "ok"; value: string }
  | {
      tag: "err"
      value: { reason: types.PublishIntentResponseFailure["reason"] }
    }

export async function publishIntent(
  signatureData: WalletSignatureResult,
  userInfo: { userAddress: string; userChainType: ChainType },
  quoteHashes: string[]
): Promise<PublishIntentResult> {
  let retryCount = 0
  let result: types.PublishIntentResponse["result"] | null = null
  while (retryCount < 7) {
    result = await solverRelayClient.publishIntent({
      signed_data: prepareSwapSignedData(signatureData, userInfo),
      quote_hashes: quoteHashes,
    })
    if (result.status === "OK") return { tag: "ok", value: result.intent_hash }
    if (result.status === "FAILED" && result.reason === "already processed")
      return { tag: "ok", value: result.intent_hash }

    retryCount++
  }

  if (result === null) throw new Error("Failed to publish intent")

  return { tag: "err", value: { reason: result.status } }
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
