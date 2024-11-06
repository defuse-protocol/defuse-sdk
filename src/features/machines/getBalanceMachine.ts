import { base64 } from "@scure/base"
import {
  getNearBalance,
  getNearNep141BalanceAccount,
  getNearNep141StorageBalanceBounds,
  getNearNep141StorageBalanceOf,
} from "../../services/nearHttpClient"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../types/base"
import { Semaphore } from "../../utils/semaphore"
import { isBaseToken, isUnifiedToken } from "../../utils/token"

export const RESERVED_NEAR_BALANCE = 1n * 10n ** 24n // 1 NEAR reserved for transaction fees and storage, using yoctoNEAR precision
const semaphore = new Semaphore(5, 500) // 5 concurrent request, 0.5 second delay (adjust maxConcurrent and delayMs as needed)

export const getNearNativeBalance = async ({
  accountId,
}: {
  accountId: string
}): Promise<bigint | null> => {
  try {
    const response = await getNearBalance({
      request_type: "view_account",
      finality: "final",
      account_id: accountId,
    })

    const balance = BigInt(response.amount)
    return balance < RESERVED_NEAR_BALANCE
      ? 0n
      : balance - RESERVED_NEAR_BALANCE
  } catch (err: unknown) {
    console.warn(err, "error fetching near native balance")
    return null
  }
}

export const getNearNep141Balance = async ({
  tokenAddress,
  accountId,
}: {
  tokenAddress: string
  accountId: string
}): Promise<bigint | null> => {
  try {
    const args = { account_id: accountId }
    const argsBase64 = Buffer.from(JSON.stringify(args)).toString("base64")

    const response = await getNearNep141BalanceAccount({
      request_type: "call_function",
      method_name: "ft_balance_of",
      account_id: tokenAddress,
      args_base64: argsBase64,
      finality: "optimistic",
    })

    const uint8Array = new Uint8Array(response.result)
    const decoder = new TextDecoder()
    const parsed = JSON.parse(decoder.decode(uint8Array))
    const balance = BigInt(parsed)
    return balance
  } catch (err: unknown) {
    console.warn(err, "error fetching near nep141 balance")
    return null
  }
}

/**
 * @returns An object where the keys are defuseAssetIds (which must be unique) and the values are balances
 */
export const getNearNep141Balances = async ({
  tokenList,
  accountId,
}: {
  tokenList: Array<BaseTokenInfo | UnifiedTokenInfo>
  accountId: string
}): Promise<Record<string, bigint>> => {
  try {
    const tokenMap = mapTokenList(tokenList).filter(([_, tokenAddress]) =>
      tokenAddress.includes("nep141:")
    )
    const results = await Promise.all([
      ...tokenMap.map(async ([tokenId, tokenAddress]) => {
        await semaphore.acquire()
        try {
          return {
            [tokenId]: await getNearNep141Balance({
              tokenAddress,
              accountId,
            }),
          }
        } finally {
          semaphore.release()
        }
      }),
    ])

    return Object.assign({}, ...results)
  } catch (err: unknown) {
    throw new Error("Error fetching balances", { cause: err })
  }
}

function mapTokenList(
  tokenList: Array<BaseTokenInfo | UnifiedTokenInfo>
): Array<[string, string]> {
  return tokenList.reduce<Array<[string, string]>>((acc, token) => {
    if (isBaseToken(token)) {
      acc.push([token.defuseAssetId, token.address])
    }
    if (isUnifiedToken(token)) {
      for (const groupToken of token.groupedTokens) {
        acc.push([groupToken.defuseAssetId, groupToken.address])
      }
    }
    return acc
  }, [])
}

export const getNearNep141StorageBalance = async ({
  contractId,
  accountId,
}: {
  contractId: string
  accountId: string
}): Promise<bigint> => {
  try {
    const args = { account_id: accountId }
    const argsBase64 = Buffer.from(JSON.stringify(args)).toString("base64")

    const response = await getNearNep141StorageBalanceOf({
      request_type: "call_function",
      method_name: "storage_balance_of",
      account_id: contractId,
      args_base64: argsBase64,
      finality: "optimistic",
    })

    const uint8Array = new Uint8Array(response.result)
    const decoder = new TextDecoder()
    const parsed = JSON.parse(decoder.decode(uint8Array))
    return BigInt(parsed?.total || "0")
  } catch (err: unknown) {
    throw new Error("Error fetching balance", { cause: err })
  }
}

export const getNearNep141MinStorageBalance = async ({
  contractId,
}: {
  contractId: string
}): Promise<bigint> => {
  const response = await getNearNep141StorageBalanceBounds({
    request_type: "call_function",
    method_name: "storage_balance_bounds",
    account_id: contractId,
    args_base64: base64.encode(new TextEncoder().encode(JSON.stringify({}))),
    finality: "optimistic",
  })

  const uint8Array = new Uint8Array(response.result)
  const decoder = new TextDecoder()
  const parsed = JSON.parse(decoder.decode(uint8Array))
  return BigInt(parsed.min)
}
