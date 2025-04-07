import { config } from "../../config"
import type * as types from "./types"

async function request(url: string, body: unknown): Promise<Response> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (response.ok) {
    return response
  }

  throw new ResponseError(response, "Response returned an error code")
}

export async function jsonRPCRequest<
  T extends types.JSONRPCRequest<unknown, unknown>,
>(method: T["method"], params: T["params"][0]) {
  const response = await request(`${config.env.poaBridgeBaseURL}/rpc`, {
    id: "dontcare",
    jsonrpc: "2.0",
    method,
    params: params !== undefined ? [params] : undefined,
  })
  return response.json()
}
class ResponseError extends Error {
  name = "ResponseError"
  constructor(
    public response: Response,
    msg?: string
  ) {
    super(msg)
  }
}
