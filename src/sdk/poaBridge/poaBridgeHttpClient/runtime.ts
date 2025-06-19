import { retry } from "@lifeomic/attempt"
import { z } from "zod"
import { config as globalConfig } from "../../../config"
import { handleRPCResponse } from "../../../utils/handleRPCResponse"
import { request } from "../../../utils/request"
import { requestShouldRetry } from "../../../utils/requestShouldRetry"
import type * as types from "./types"

const rpcResponseSchema = z.union([
  // success
  z.object({
    jsonrpc: z.literal("2.0"),
    id: z.string(),
    result: z.unknown(),
  }),
  // error
  z.object({
    jsonrpc: z.literal("2.0"),
    id: z.string(),
    error: z.string().transform((v) => ({
      code: -1,
      data: null,
      message: v,
    })),
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
    id: config?.requestId ?? "dontcare",
    jsonrpc: "2.0",
    method,
    params: params !== undefined ? [params] : undefined,
  }

  const response = await retry(
    () => {
      return request({
        url,
        body,
        ...config,
        fetchOptions: {
          ...config?.fetchOptions,
          method: "POST",
        },
      })
    },
    {
      delay: 200,
      maxAttempts: 3,
      handleError: (err, context) => {
        if (!requestShouldRetry(err)) {
          context.abort
        }
      },
    }
  )

  return handleRPCResponse(response, body, rpcResponseSchema)
}
