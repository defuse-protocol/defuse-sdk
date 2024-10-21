import type { DefuseMessageFor_DefuseIntents } from "../../types/defuse-contracts-types"

export type JSONRPCRequest<Method, Params> = {
  id: string
  jsonrpc: "2.0"
  method: Method
  params: Params[]
}

export type JSONRPCResponse<Result> = {
  id: string
  jsonrpc: "2.0"
  result: Result
}

export type QuoteRequest = JSONRPCRequest<
  "quote",
  {
    defuse_asset_identifier_in: string
    defuse_asset_identifier_out: string
    amount_in: string
    min_deadline_ms?: number
  }
>

export type QuoteResponse = JSONRPCResponse<null | Array<{
  quote_hash: string
  defuse_asset_identifier_in: string
  defuse_asset_identifier_out: string
  amount_in: string
  amount_out: string
  expiration_time: number
}>>

export type PublishIntentRequest = JSONRPCRequest<
  "publish_intent",
  {
    quote_hashes: string[]
    signed_data: {
      standard: string
      message: DefuseMessageFor_DefuseIntents[]
      signature: string
      public_key: string
      nonce: string
      recipient: string
    }
  }
>

export type PublishIntentResponse = JSONRPCResponse<
  | {
      intent_hash: string
      status: "OK"
    }
  | {
      intent_hash: string
      status: "FAILED"
      reason: string | "expired" | "internal"
    }
>

export type GetStatusRequest = JSONRPCRequest<
  "get_status",
  { intent_hash: string }
>

export type GetStatusResponse = JSONRPCResponse<{
  intent_hash: string
  status:
    | "PENDING"
    | "TX_BROADCASTED"
    | "SETTLED"
    | "NOT_FOUND_OR_NOT_VALID_ANYMORE"
  data?: { hash: string }
}>
