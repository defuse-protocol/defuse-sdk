import type {
  SignedPayloadFor_MultiStandardPayload,
  SignedPayloadFor_MultiStandardPayload1,
} from "../../types/defuse-contracts-types"

export type RequestConfig = {
  signal?: AbortSignal
}

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
    exact_amount_in?: string
    exact_amount_out?: string
    min_deadline_ms?: number
  }
>

export type Params<T extends JSONRPCRequest<unknown, unknown>> = T["params"][0]

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
    signed_data: SignedPayloadFor_MultiStandardPayload1 &
      SignedPayloadFor_MultiStandardPayload
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

export type GetStatusResponse = JSONRPCResponse<
  | {
      status: "PENDING"
      intent_hash: string
    }
  | {
      status: "TX_BROADCASTED"
      intent_hash: string
      data: { hash: string }
    }
  | {
      status: "SETTLED"
      intent_hash: string
      data: { hash: string }
    }
  | {
      status: "NOT_FOUND_OR_NOT_VALID"
      intent_hash: string
    }
>
