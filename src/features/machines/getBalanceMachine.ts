import {
  getNearBalance,
  getNearNep141BalanceAccount,
} from "src/services/nearHttpClient"

const RESERVED_NEAR_BALANCE = 1n * 10n ** 24n // 1 NEAR reserved for transaction fees and storage, using yoctoNEAR precision

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
