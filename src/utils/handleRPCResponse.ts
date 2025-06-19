import type { z } from "zod"
import { RpcRequestError } from "../errors/request"

type SuccessResult<result> = {
  result: result
  error?: undefined
}
type ErrorResult<error> = {
  result?: undefined
  error: error
}
export type RpcResponse<TResult = unknown, TError = unknown> = {
  jsonrpc: `${number}`
  id: number | string
} & (SuccessResult<TResult> | ErrorResult<TError>)

export async function handleRPCResponse<
  TSchema extends z.ZodType<TOutput, z.ZodTypeDef, TInput>,
  TInput,
  TOutput extends RpcResponse<
    unknown,
    { code: number; data: unknown; message: string }
  >,
>(response: Response, body: unknown, schema: TSchema) {
  const json = await response.json()

  const parsed = schema.safeParse(json)
  if (parsed.success) {
    if (parsed.data.error !== undefined) {
      throw new RpcRequestError({
        body,
        error: parsed.data.error,
        url: response.url,
      })
    }

    return parsed.data.result
  }

  throw new RpcRequestError({
    body,
    error: { code: -1, data: json, message: "Invalid response" },
    url: response.url,
  })
}
