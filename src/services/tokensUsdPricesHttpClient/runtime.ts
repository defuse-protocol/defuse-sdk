const BASE_URL = "https://api-mng-console.chaindefuser.com/api"

export async function request(path: string): Promise<Response> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`)
  } catch (err) {
    throw new FetchError("The request failed", { cause: err })
  }

  if (response.ok) {
    return response
  }

  throw new ResponseError(response, "Response returned an error code")
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
