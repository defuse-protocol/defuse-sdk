import type { providers } from "near-api-js"
import { settings } from "src/config/settings"
import { nearFailoverRpcProvider } from "src/utils/failover"

export const getNearTxSuccessValue = async ({
  txHash,
  senderAccountId,
}: {
  txHash: string
  senderAccountId: string
}): Promise<bigint> => {
  try {
    const nearClient = nearFailoverRpcProvider({
      urls: settings.reserveRpcUrls.near,
    })

    const response = (await nearClient.txStatus(
      txHash,
      senderAccountId,
      "EXECUTED"
    )) as providers.FinalExecutionOutcome

    const status = response.status as { SuccessValue?: string }
    if (status.SuccessValue) {
      const decodedValue = Buffer.from(status.SuccessValue, "base64").toString(
        "utf-8"
      )
      // Parse the JSON string and convert to BigInt
      return BigInt(JSON.parse(decodedValue))
    }
    return 0n
  } catch (err: unknown) {
    throw new Error("Error fetching tx status", { cause: err })
  }
}
