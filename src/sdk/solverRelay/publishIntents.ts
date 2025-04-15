import { retry } from "@lifeomic/attempt"
import { Err, Ok, type Result } from "@thames/monads"
import { logger } from "../../logger"
import * as solverRelayClient from "./solverRelayHttpClient"

export async function publishIntents(
  ...args: Parameters<typeof solverRelayClient.publishIntents>
): Promise<Result<PublishIntentsOk, PublishIntentsErr>> {
  return retry(() => solverRelayClient.publishIntents(...args), {
    delay: 1000,
    factor: 1.5,
    maxAttempts: 7,
    jitter: true,
    minDelay: 1000,
  })
    .then(parsePublishIntentsResponse, (err) => {
      logger.error(new Error("Failed to publish intents", { cause: err }))
      return Err<PublishIntentsOk, PublishIntentsErr>({
        reason: "RELAY_PUBLISH_NETWORK_ERROR",
      })
    })
    .then((result) => {
      if (result.isErr()) {
        const err = result.unwrapErr()
        if (err.reason === "RELAY_PUBLISH_UNKNOWN_ERROR") {
          logger.error(err.serverReason)
        }
      }
      return result
    })
}

export type PublishIntentsOk = string[]
export type PublishIntentsErr =
  | {
      reason:
        | "RELAY_PUBLISH_SIGNATURE_EXPIRED"
        | "RELAY_PUBLISH_INTERNAL_ERROR"
        | "RELAY_PUBLISH_SIGNATURE_INVALID"
        | "RELAY_PUBLISH_NONCE_USED"
        | "RELAY_PUBLISH_INSUFFICIENT_BALANCE"
        | "RELAY_PUBLISH_NETWORK_ERROR"
        | "RELAY_PUBLISH_PUBLIC_NOT_EXIST"
    }
  | {
      reason: "RELAY_PUBLISH_UNKNOWN_ERROR"
      serverReason: string
    }

function parsePublishIntentsResponse(
  response: Awaited<ReturnType<typeof solverRelayClient.publishIntents>>
): Result<PublishIntentsOk, PublishIntentsErr> {
  if (response.status === "OK") {
    return Ok(response.intent_hashes)
  }

  if (response.reason === "already processed") {
    return Ok(response.intent_hashes)
  }

  if (
    response.reason === "expired" ||
    response.reason.includes("deadline has expired")
  ) {
    return Err({ reason: "RELAY_PUBLISH_SIGNATURE_EXPIRED" })
  }

  if (response.reason === "internal") {
    return Err({ reason: "RELAY_PUBLISH_INTERNAL_ERROR" })
  }

  if (response.reason.includes("invalid signature")) {
    return Err({ reason: "RELAY_PUBLISH_SIGNATURE_INVALID" })
  }

  if (response.reason.includes("nonce was already used")) {
    return Err({ reason: "RELAY_PUBLISH_NONCE_USED" })
  }

  if (response.reason.includes("insufficient balance or overflow")) {
    return Err({ reason: "RELAY_PUBLISH_INSUFFICIENT_BALANCE" })
  }

  if (response.reason.includes("public key doesn't exist")) {
    return Err({ reason: "RELAY_PUBLISH_PUBLIC_NOT_EXIST" })
  }

  return Err({
    reason: "RELAY_PUBLISH_UNKNOWN_ERROR",
    serverReason: response.reason,
  })
}
