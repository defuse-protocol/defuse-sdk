import { jsonRPCRequest } from "./runtime"
import type * as types from "./types"

export async function quote(
  params: types.QuoteRequest["params"][0],
  config: types.RequestConfig = {}
): Promise<types.QuoteResponse["result"]> {
  const json = await jsonRPCRequest<types.QuoteRequest>("quote", params, config)
  return json.result
}

export async function publishIntent(
  params: types.PublishIntentRequest["params"][0],
  config: types.RequestConfig = {}
): Promise<types.PublishIntentResponse["result"]> {
  const json = await jsonRPCRequest<types.PublishIntentRequest>(
    "publish_intent",
    params,
    config
  )
  return json.result
}

export async function getStatus(
  params: types.GetStatusRequest["params"][0],
  config: types.RequestConfig = {}
): Promise<types.GetStatusResponse["result"]> {
  const json = await jsonRPCRequest<types.GetStatusRequest>(
    "get_status",
    params,
    config
  )
  return json.result
}
