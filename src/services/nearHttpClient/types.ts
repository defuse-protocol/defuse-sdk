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

export type GetNearBalanceRequest = JSONRPCRequest<
  "query",
  {
    request_type: "view_account"
    account_id: string
    finality: "final"
  }
>

export type GetNearBalanceResponse = JSONRPCResponse<{
  amount: string
  block_hash: string
  block_height: number
  code_hash: string
  locked: string
  storage_paid_at: number
  storage_usage: number
}>

export type GetNearNep141BalanceAccountRequest = JSONRPCRequest<
  "query",
  {
    request_type: "call_function"
    account_id: string
    method_name: "ft_balance_of"
    args_base64: string
    finality: "optimistic"
  }
>

export type GetNearNep141BalanceAccountResponse = JSONRPCResponse<{
  block_hash: string
  block_height: number
  logs: []
  result: number[]
}>

export type GetNearTxRequest = JSONRPCRequest<
  "tx",
  {
    tx_hash: string
    sender_account_id: string
    wait_until: "EXECUTED"
  }
>

export type GetNearTxResponse = JSONRPCResponse<{
  status: { SuccessValue: string }
}>

export type GetNearNep141StorageBalanceOfRequest = JSONRPCRequest<
  "query",
  {
    request_type: "call_function"
    account_id: string
    method_name: "storage_balance_of"
    args_base64: string
    finality: "optimistic"
  }
>

export type GetNearNep141StorageBalanceOfResponse = JSONRPCResponse<{
  block_hash: string
  block_height: number
  logs: []
  result: number[]
}>

export type GetNearNep141StorageBalanceBoundsRequest = JSONRPCRequest<
  "query",
  {
    request_type: "call_function"
    account_id: string
    method_name: "storage_balance_bounds"
    args_base64: string
    finality: "optimistic"
  }
>

export type GetNearNep141StorageBalanceBoundsResponse = JSONRPCResponse<{
  block_hash: string
  block_height: number
  logs: []
  result: number[]
}>
