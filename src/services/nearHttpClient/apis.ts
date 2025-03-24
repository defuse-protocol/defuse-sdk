import { jsonRPCRequest } from "./runtime"
import type * as types from "./types"

// TODO: Has to be analized runtime function as we have double requests using jsonRPCRequest, such behavior should be avoided.

export async function getNearBalance(
  params: types.GetNearBalanceRequest["params"][0]
): Promise<types.GetNearBalanceResponse["result"]> {
  const json = await jsonRPCRequest<types.GetNearBalanceRequest>(
    "query",
    params
  )
  return json.result
}

export async function getNearNep141BalanceAccount(
  params: types.GetNearNep141BalanceAccountRequest["params"][0]
): Promise<types.GetNearNep141BalanceAccountResponse["result"]> {
  const json = await jsonRPCRequest<types.GetNearNep141BalanceAccountRequest>(
    "query",
    params
  )
  return json.result
}

export async function getTx(
  params: types.GetNearTxRequest["params"][0]
): Promise<types.GetNearTxResponse["result"]> {
  const json = await jsonRPCRequest<types.GetNearTxRequest>("tx", params)
  return json.result
}

export async function getNearNep141StorageBalanceOf(
  params: types.GetNearNep141StorageBalanceOfRequest["params"][0]
): Promise<types.GetNearNep141StorageBalanceOfResponse["result"]> {
  const json = await jsonRPCRequest<types.GetNearNep141StorageBalanceOfRequest>(
    "query",
    params
  )
  return json.result
}

export async function getNearNep141StorageBalanceBounds(
  params: types.GetNearNep141StorageBalanceBoundsRequest["params"][0]
): Promise<types.GetNearNep141StorageBalanceBoundsResponse["result"]> {
  const json =
    await jsonRPCRequest<types.GetNearNep141StorageBalanceBoundsRequest>(
      "query",
      params
    )
  return json.result
}
