import type { PublishIntentResult } from "src/services/intentService"

export default function extractPublishIntentError(
  result: PublishIntentResult
): Error {
  return result.tag === "err"
    ? new Error(`Failed to publish intent, reason: ${result.value.reason}`)
    : new Error("Unknown error")
}
