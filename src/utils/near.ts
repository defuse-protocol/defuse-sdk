import { getNearProvider, setNearProvider } from "@near-eth/client"
import { providers } from "near-api-js"
import type { CodeResult } from "near-api-js/lib/providers/provider"

import type { NearViewAccount } from "../types"

// Accessing ENV in the browser is not recommended.
// Instead, it is better to explicitly pass values to functions.
// For now help bundler to tree-shake the constant.
const NEAR_NODE_URL = /*@__PURE__*/ (() =>
  process?.env?.nearNodeUrl ?? "https://rpc.testnet.near.org")()

export const storageBalance = async (contractId: string, accountId: string) => {
  try {
    setNearProvider(
      new providers.JsonRpcProvider({ url: NEAR_NODE_URL }) as any // eslint-disable-line
    )

    const nearProvider = getNearProvider()
    const result = await nearProvider.query<CodeResult>({
      request_type: "call_function",
      account_id: contractId,
      method_name: "storage_balance_of",
      args_base64: Buffer.from(
        JSON.stringify({ account_id: accountId })
      ).toString("base64"),
      finality: "optimistic",
    })
    const balance = JSON.parse(Buffer.from(result.result).toString())
    // console.log("Fetching near storage balance of result:", result)
    return BigInt(balance?.total || "0")
  } catch (e) {
    console.error("Failed to check storage balance")
    return null
  }
}

export const nearAccount = async (
  accountId: string
): Promise<NearViewAccount | null> => {
  try {
    setNearProvider(
      new providers.JsonRpcProvider({ url: NEAR_NODE_URL }) as any // eslint-disable-line
    )

    const nearProvider = getNearProvider()
    const result = await nearProvider.query({
      request_type: "view_account",
      finality: "final",
      account_id: accountId,
    })
    // console.log("Fetching near account result:", result)
    return result as NearViewAccount
  } catch (e) {
    console.error(`Failed to fetch account or it doesn't exist - ${accountId}`)
    return null
  }
}

export const nep141Balance = async (
  accountId: string,
  contractId: string
): Promise<string | null> => {
  try {
    setNearProvider(
      new providers.JsonRpcProvider({ url: NEAR_NODE_URL }) as any // eslint-disable-line
    )
    const nearProvider = getNearProvider()
    const storageBalance = await nearProvider.query<CodeResult>({
      request_type: "call_function",
      account_id: contractId,
      method_name: "ft_balance_of",
      args_base64: Buffer.from(
        JSON.stringify({ account_id: accountId })
      ).toString("base64"),
      finality: "optimistic",
    })
    // console.log(
    //   `ft_balance_of ${contractId} for ${accountId} is ${storageBalance}`
    // )
    return JSON.parse(Buffer.from(storageBalance.result).toString())
  } catch (e) {
    console.error("Failed to check NEP-141 balance")
    return null
  }
}

export const intentStatus = async (
  contractId: string,
  intentId: string
): Promise<string | null> => {
  try {
    setNearProvider(
      new providers.JsonRpcProvider({ url: NEAR_NODE_URL }) as any // eslint-disable-line
    )

    const nearProvider = getNearProvider()
    const result = await nearProvider.query<CodeResult>({
      request_type: "call_function",
      account_id: contractId,
      method_name: "get_intent",
      args_base64: Buffer.from(JSON.stringify({ id: intentId })).toString(
        "base64"
      ),
      finality: "optimistic",
    })
    console.log(`get_intent ${contractId} for ${intentId} status is ${result}`)
    const intent = JSON.parse(Buffer.from(result.result).toString())
    return intent
  } catch (e) {
    console.error("Failed to get intent status")
    return null
  }
}

export const isStorageDepositException = (contractId: string): boolean => {
  const exceptionKeys = ["aurora"]
  return exceptionKeys.includes(contractId)
}
