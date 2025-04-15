import { retry } from "@lifeomic/attempt"
import type { AuthMethod } from "../../types/authHandle"
import type { WalletSignatureResult } from "../../types/walletMessage"
import { prepareSwapSignedData } from "../../utils/prepareBroadcastRequest"
import * as solverRelayClient from "./solverRelayHttpClient"
import type * as types from "./solverRelayHttpClient/types"

export type PublishIntentResult =
  | { tag: "ok"; value: string }
  | {
      tag: "err"
      value: { reason: types.PublishIntentResponseFailure["reason"] }
    }

export async function publishIntent(
  signatureData: WalletSignatureResult,
  userInfo: { userAddress: string; userChainType: AuthMethod },
  quoteHashes: string[]
): Promise<PublishIntentResult> {
  const result = await retry<types.PublishIntentResponse["result"]>(
    async () =>
      solverRelayClient.publishIntent({
        signed_data: prepareSwapSignedData(signatureData, userInfo),
        quote_hashes: quoteHashes,
      }),
    {
      delay: 1000,
      factor: 1.5,
      maxAttempts: 7,
      jitter: true,
      minDelay: 1000,
    }
  )
  if (result.status === "OK") {
    return { tag: "ok", value: result.intent_hash }
  }

  if (result.status === "FAILED" && result.reason === "already processed") {
    return { tag: "ok", value: result.intent_hash }
  }

  if (
    result.status === "FAILED" &&
    result.reason.includes("nonce was already used")
  ) {
    return { tag: "err", value: { reason: "nonce_used" } }
  }

  return { tag: "err", value: { reason: result.status } }
}
