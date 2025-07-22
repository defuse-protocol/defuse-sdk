import type { solverRelay } from "@defuse-protocol/internal-utils"
import type { Result } from "@thames/monads"
import { assert } from "../../../utils/assert"
import type * as solverRelayClient from "../solverRelayHttpClient"

export type ParsedPublishErrors =
  | {
      reason:
        | "RELAY_PUBLISH_SIGNATURE_EXPIRED"
        | "RELAY_PUBLISH_INTERNAL_ERROR"
        | "RELAY_PUBLISH_SIGNATURE_INVALID"
        | "RELAY_PUBLISH_NONCE_USED"
        | "RELAY_PUBLISH_INSUFFICIENT_BALANCE"
        | "RELAY_PUBLISH_PUBLIC_NOT_EXIST"
    }
  | {
      reason: "RELAY_PUBLISH_UNKNOWN_ERROR"
      serverReason: string
    }

export function parseFailedPublishError(
  response:
    | Awaited<ReturnType<typeof solverRelayClient.publishIntents>>
    | Awaited<ReturnType<typeof solverRelayClient.publishIntent>>
): ParsedPublishErrors {
  assert(response.status === "FAILED", "Expected response to be failed")

  if (
    response.reason === "expired" ||
    response.reason.includes("deadline has expired")
  ) {
    return { reason: "RELAY_PUBLISH_SIGNATURE_EXPIRED" }
  }

  if (response.reason === "internal") {
    return { reason: "RELAY_PUBLISH_INTERNAL_ERROR" }
  }

  if (response.reason.includes("invalid signature")) {
    return { reason: "RELAY_PUBLISH_SIGNATURE_INVALID" }
  }

  if (response.reason.includes("nonce was already used")) {
    return { reason: "RELAY_PUBLISH_NONCE_USED" }
  }

  if (response.reason.includes("insufficient balance or overflow")) {
    return { reason: "RELAY_PUBLISH_INSUFFICIENT_BALANCE" }
  }

  if (response.reason.includes("public key doesn't exist")) {
    return { reason: "RELAY_PUBLISH_PUBLIC_NOT_EXIST" }
  }

  return {
    reason: "RELAY_PUBLISH_UNKNOWN_ERROR",
    serverReason: response.reason,
  }
}

/**
 * Adapter function that converts the new Result<string, PublishIntentsErrorType>
 * from internal-utils into the legacy format used by the SDK.
 */
export function convertPublishIntentToLegacyFormat(
  result: Result<string, solverRelay.PublishIntentsErrorType>
):
  | { tag: "ok"; value: string }
  | {
      tag: "err"
      value: { reason: "ERR_CANNOT_PUBLISH_INTENT"; server_reason: string }
    } {
  if (result.isOk()) {
    return { tag: "ok", value: result.unwrap() }
  }

  const error = result.unwrapErr()
  const errorCode = error.code

  // Map new PublishErrorCode to old ParsedPublishErrors format
  let serverReason: string
  switch (errorCode) {
    case "SIGNATURE_EXPIRED":
      serverReason = "RELAY_PUBLISH_SIGNATURE_EXPIRED"
      break
    case "INTERNAL_ERROR":
      serverReason = "RELAY_PUBLISH_INTERNAL_ERROR"
      break
    case "SIGNATURE_INVALID":
      serverReason = "RELAY_PUBLISH_SIGNATURE_INVALID"
      break
    case "NONCE_USED":
      serverReason = "RELAY_PUBLISH_NONCE_USED"
      break
    case "INSUFFICIENT_BALANCE":
      serverReason = "RELAY_PUBLISH_INSUFFICIENT_BALANCE"
      break
    case "PUBLIC_KEY_NOT_EXIST":
      serverReason = "RELAY_PUBLISH_PUBLIC_NOT_EXIST"
      break
    case "UNKNOWN_ERROR":
      serverReason = "RELAY_PUBLISH_UNKNOWN_ERROR"
      break
    case "NETWORK_ERROR":
      serverReason = "RELAY_PUBLISH_NETWORK_ERROR"
      break
    default:
      serverReason = errorCode
  }

  return {
    tag: "err",
    value: {
      reason: "ERR_CANNOT_PUBLISH_INTENT",
      server_reason: serverReason,
    },
  }
}
