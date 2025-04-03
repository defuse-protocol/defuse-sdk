import * as v from "valibot"

/**
 * Use this function to decode a raw response from `nearClient.query()`
 */
export function decodeQueryResult<
  T extends v.BaseSchema<TInput, TOutput, TIssue>,
  TInput,
  TOutput,
  TIssue extends v.BaseIssue<unknown>,
>(response: unknown, schema: T): v.InferOutput<T> {
  const parsed = v.parse(v.object({ result: v.array(v.number()) }), response)
  const uint8Array = new Uint8Array(parsed.result)
  const decoder = new TextDecoder()
  const result = decoder.decode(uint8Array)
  return v.parse(schema, JSON.parse(result))
}

// Copied from https://github.com/mynearwallet/my-near-wallet/blob/3b1a6c6e5c62a0235f5e32d370f803fa2180c6f8/packages/frontend/src/utils/wallet.ts#L75

const ACCOUNT_ID_REGEX = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/

const IMPLICIT_ACCOUNT_MAX_LENGTH = 64

export function isLegitAccountId(accountId: string): boolean {
  return ACCOUNT_ID_REGEX.test(accountId)
}

export function isImplicitAccount(accountId: string): boolean {
  return (
    accountId.length === IMPLICIT_ACCOUNT_MAX_LENGTH && !accountId.includes(".")
  )
}
