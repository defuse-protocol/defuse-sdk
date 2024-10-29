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

export type GetSupportedTokensRequest = JSONRPCRequest<
  "supported_tokens",
  {
    chains?: string[]
  }
>

export type GetSupportedTokensResponse = JSONRPCResponse<{
  tokens: {
    defuse_asset_identifier: string
    decimals: number
    asset_name: string
    near_token_id: string
    min_deposit_amount: number
  }[]
}>

export type GetDepositAddressRequest = JSONRPCRequest<
  "deposit_address",
  {
    account_id: string
    /** Chain is joined blockchain and network (e.g. eth:8453) */
    chain: string
  }
>
export type GetDepositAddressResponse = JSONRPCResponse<{
  address: string
  chain: string
}>
