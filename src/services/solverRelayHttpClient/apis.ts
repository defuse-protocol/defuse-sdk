import { jsonRPCRequest } from "./runtime"
import type * as types from "./types"

export async function quote(
  params: types.QuoteRequest["params"][0]
): Promise<types.QuoteResponse["result"]> {
  const json = await jsonRPCRequest<types.QuoteRequest>("quote", params)
  return json.result
}

export async function publishIntent(
  params: types.PublishIntentRequest["params"][0]
): Promise<types.PublishIntentResponse["result"]> {
  const json = await jsonRPCRequest<types.PublishIntentRequest>(
    "publish_intent",
    params
  )
  return json.result
}

export async function getStatus(
  params: types.GetStatusRequest["params"][0]
): Promise<types.GetStatusResponse["result"]> {
  const json = await jsonRPCRequest<types.GetStatusRequest>(
    "get_status",
    params
  )
  return json.result
}
