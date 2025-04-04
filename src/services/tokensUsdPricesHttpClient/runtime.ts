import { config } from "../../config"

export async function request(path: string): Promise<Response> {
  const response = await fetch(`${config.env.managerConsoleBaseURL}${path}`)

  if (response.ok) {
    return response
  }

  throw new ResponseError(response, "Response returned an error code")
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
