import { jsonRPCRequest } from "./runtime"
import type * as types from "./types"

export async function getSupportedTokens(
  params: types.GetSupportedTokensRequest["params"][0]
): Promise<types.GetSupportedTokensResponse["result"]> {
  const json = await jsonRPCRequest<types.GetSupportedTokensRequest>(
    "supported_tokens",
    params
  )
  return json.result
}

export async function getDepositAddress(
  params: types.GetDepositAddressRequest["params"][0]
): Promise<types.GetDepositAddressResponse["result"]> {
  const json = await jsonRPCRequest<types.GetDepositAddressRequest>(
    "deposit_address",
    params
  )
  return json.result
}

export async function getDepositStatus(
  params: types.GetDepositStatusRequest["params"][0]
): Promise<types.GetDepositStatusResponse["result"]> {
  const json = await jsonRPCRequest<types.GetDepositStatusRequest>(
    "recent_deposits",
    params
  )
  return json.result ?? { deposits: [] }
}
