import {
  getNearBalance,
  getNearNep141BalanceAccount,
} from "src/services/nearHttpClient"
import type { BaseTokenInfo, UnifiedTokenInfo } from "src/types/base"
import { isBaseToken, isUnifiedToken } from "src/utils"
import { Semaphore } from "../../utils/semaphore"

const RESERVED_NEAR_BALANCE = 1n * 10n ** 24n // 1 NEAR reserved for transaction fees and storage, using yoctoNEAR precision
const semaphore = new Semaphore(5, 500) // 5 concurrent request, 0.5 second delay (adjust maxConcurrent and delayMs as needed)

export const getNearNativeBalance = async ({
  userAddress,
}: {
  userAddress: string
}): Promise<bigint> => {
  try {
    const response = await getNearBalance({
      request_type: "view_account",
      finality: "final",
      account_id: userAddress,
    })

    const balance = BigInt(response.amount)
    return balance < RESERVED_NEAR_BALANCE
      ? 0n
      : balance - RESERVED_NEAR_BALANCE
  } catch (err: unknown) {
    throw new Error("Error fetching balance", { cause: err })
  }
}

export const getNearNep141Balance = async ({
  tokenAddress,
  userAddress,
}: {
  tokenAddress: string
  userAddress: string
}): Promise<bigint> => {
  try {
    const args = { account_id: userAddress }
    const argsBase64 = Buffer.from(JSON.stringify(args)).toString("base64")

    const response = await getNearNep141BalanceAccount({
      request_type: "call_function",
      method_name: "ft_balance_of",
      account_id: tokenAddress,
      args_base64: argsBase64,
      finality: "optimistic",
    })

    const balance = BigInt(JSON.parse(Buffer.from(response.result).toString()))
    return balance
  } catch (err: unknown) {
    throw new Error("Error fetching balance", { cause: err })
  }
}

/**
 * @returns An object where the keys are defuseAssetIds (which must be unique) and the values are balances
 */
export const getNearBalances = async ({
  tokenList,
  userAddress,
}: {
  tokenList: Array<BaseTokenInfo | UnifiedTokenInfo>
  userAddress: string
}): Promise<Record<string, bigint>> => {
  try {
    const tokenMap = mapTokenList(tokenList).filter(
      ([_, tokenAddress]) => tokenAddress !== "near"
    )
    const results = await Promise.all([
      ...tokenMap.map(async ([tokenId, tokenAddress]) => {
        await semaphore.acquire()
        try {
          return {
            [tokenId]: await getNearNep141Balance({
              tokenAddress,
              userAddress,
            }),
          }
        } finally {
          semaphore.release()
        }
      }),
      (async () => {
        await semaphore.acquire()
        try {
          return {
            "near:native": await getNearNativeBalance({ userAddress }),
          }
        } finally {
          semaphore.release()
        }
      })(),
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
