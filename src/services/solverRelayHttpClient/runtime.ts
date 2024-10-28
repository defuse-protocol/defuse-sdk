import type * as types from "./types"

const BASE_URL = "https://solver-relay-v2.chaindefuser.com"

async function request(
  url: string,
  body: unknown,
  config: types.RequestConfig = {}
): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: config.signal,
    })
  } catch (err) {
    throw new FetchError("The request failed", { cause: err })
  }

  if (response.ok) {
    return response
  }

  throw new ResponseError(response, "Response returned an error code")
}

export async function jsonRPCRequest<
  T extends types.JSONRPCRequest<unknown, unknown>,
>(
  method: T["method"],
  params: T["params"][0],
  config: types.RequestConfig = {}
) {
  const response = await request(
    `${BASE_URL}/rpc`,
    {
      id: "dontcare",
      jsonrpc: "2.0",
      method,
      params: params !== undefined ? [params] : undefined,
    },
    config
  )
  return response.json()
}

class FetchError extends Error {
  name = "FetchError"
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
