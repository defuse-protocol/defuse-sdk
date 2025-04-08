import { config as globalConfig } from "../../config"
import { request } from "../../utils/request"
import type * as types from "./types"

export async function jsonRPCRequest<
  T extends types.JSONRPCRequest<unknown, unknown>,
>(
  method: T["method"],
  params: T["params"][0],
  config?: types.RequestConfig | undefined
) {
  const response = await request({
    url: `${globalConfig.env.solverRelayBaseURL}/rpc`,
    body: {
      id: "dontcare",
      jsonrpc: "2.0",
      method,
      params: params !== undefined ? [params] : undefined,
    },
    ...config,
    fetchOptions: {
      ...config?.fetchOptions,
      method: "POST",
    },
  })
  return response.json()
}
