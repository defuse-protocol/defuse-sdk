import { getTx } from "../../services/nearHttpClient"

export const getNearTxSuccessValue = async ({
  txHash,
  senderAccountId,
}: {
  txHash: string
  senderAccountId: string
}): Promise<bigint> => {
  try {
    const response = await getTx({
      tx_hash: txHash,
      sender_account_id: senderAccountId,
      wait_until: "EXECUTED",
    })
    if (response.status?.SuccessValue) {
      const decodedValue = Buffer.from(
        response.status.SuccessValue,
        "base64"
      ).toString("utf-8")
      // Parse the JSON string and convert to BigInt
      return BigInt(JSON.parse(decodedValue))
    }
    return 0n
  } catch (err: unknown) {
    throw new Error("Error fetching tx status", { cause: err })
  }
}
