import { jsonRPCRequest } from "./runtime"
import type * as types from "./types"

export async function getSupportedTokens(
  params: types.GetSupportedTokensRequest["params"][0],
  config: types.RequestConfig = {}
): Promise<types.GetSupportedTokensResponse["result"]> {
  const json = await jsonRPCRequest<types.GetSupportedTokensRequest>(
    "supported_tokens",
    params,
    config
  )
  return json.result
}

export async function getDepositAddress(
  params: types.GetDepositAddressRequest["params"][0],
  config: types.RequestConfig = {}
): Promise<types.GetDepositAddressResponse["result"]> {
  const json = await jsonRPCRequest<types.GetDepositAddressRequest>(
    "deposit_address",
    params,
    config
  )
  return json.result
}

export async function getDepositStatus(
  params: types.GetDepositStatusRequest["params"][0],
  config: types.RequestConfig = {}
): Promise<types.GetDepositStatusResponse["result"]> {
  const json = await jsonRPCRequest<types.GetDepositStatusRequest>(
    "recent_deposits",
    params,
    config
  )
  return json.result ?? { deposits: [] }
}

export async function getWithdrawalStatus(
  params: types.WithdrawalStatusRequest["params"][0],
  config: types.RequestConfig = {}
): Promise<types.WithdrawalStatusResponseOk["result"]> {
  const json:
    | types.WithdrawalStatusResponseOk
    | types.WithdrawalStatusResponseErr =
    await jsonRPCRequest<types.WithdrawalStatusRequest>(
      "withdrawal_status",
      params,
      config
    )
  if ("error" in json) {
    throw new Error(json.error)
  }
  return json.result
}
