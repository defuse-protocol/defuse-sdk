import type * as types from "./types"

const BASE_URL = "https://nearrpc.aurora.dev"

async function request(url: string, body: unknown): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
>(method: T["method"], params: T["params"][0]) {
  const response = await request(`${BASE_URL}`, {
    id: "dontcare",
    jsonrpc: "2.0",
    method,
    params: params !== undefined ? params : undefined,
  })
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
