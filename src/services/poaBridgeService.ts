import { QueryObserver } from "@tanstack/query-core"
import { queryClient } from "../providers/QueryClientProvider"
import { createWithdrawalStatusQueryOptions } from "../queries/poaBridgeQueries"
import { assert } from "../utils/assert"

type WaitForWithdrawalCompletionResult = {
  destinationTxHash: string
  chain: string
}

export async function waitForWithdrawalCompletion({
  txHash,
  signal,
}: {
  txHash: string
  signal: AbortSignal
}) {
  const queryObserver = new QueryObserver(
    queryClient,
    createWithdrawalStatusQueryOptions({ txHash: txHash })
  )

  return new Promise<WaitForWithdrawalCompletionResult>((resolve, reject) => {
    const unsubscribe = queryObserver.subscribe((result) => {
      if (result.data == null) {
        return
      }

      // We expect it having a single withdrawal, so we take first
      const withdrawal = result.data.withdrawals[0]
      assert(withdrawal, "POA Bridge didn't return withdrawal")

      if (withdrawal.status === "COMPLETED") {
        // COMPLETED should have `transfer_tx_hash` always
        assert(
          withdrawal.data.transfer_tx_hash != null,
          "transfer_tx_hash is null"
        )

        resolve({
          destinationTxHash: withdrawal.data.transfer_tx_hash,
          chain: withdrawal.data.chain,
        })
      }
    })

    signal.addEventListener("abort", () => {
      unsubscribe()
      reject(signal.reason)
    })
  })
}
