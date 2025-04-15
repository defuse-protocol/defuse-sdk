import * as v from "valibot"
import { config as globalConfig } from "../../../config"
import { handleRPCResponse } from "../../../utils/handleRPCResponse"
import { request } from "../../../utils/request"
import type * as types from "./types"

const rpcResponseSchema = v.union([
  // success
  v.object({
    jsonrpc: v.literal("2.0"),
    id: v.string(),
    result: v.unknown(),
  }),
  // error
  v.object({
    jsonrpc: v.literal("2.0"),
    id: v.string(),
    error: v.pipe(
      v.string(),
      v.transform((v) => {
        return {
          code: -1,
          data: null,
          message: v,
        }
      })
    ),
  }),
])

export async function jsonRPCRequest<
  T extends types.JSONRPCRequest<unknown, unknown>,
>(
  method: T["method"],
  params: T["params"][0],
  config?: types.RequestConfig | undefined
) {
  const url = `${globalConfig.env.poaBridgeBaseURL}/rpc`

  const body = {
    id: "dontcare",
    jsonrpc: "2.0",
    method,
    params: params !== undefined ? [params] : undefined,
  }

  const response = await request({
    url,
    body,
    ...config,
    fetchOptions: {
      ...config?.fetchOptions,
      method: "POST",
    },
  })

  return handleRPCResponse(response, body, rpcResponseSchema)
}
