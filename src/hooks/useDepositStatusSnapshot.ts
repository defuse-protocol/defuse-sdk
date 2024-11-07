import { useCallback, useEffect, useState } from "react"
import type { DepositStatus } from "src/services/poaBridgeClient/types"
import type { DepositSnapshot } from "src/types"
import { useGetDepositStatus } from "./usePoABridge"

const INTERVAL_TIME = 1000
const RESET_DEPOSIT_RECEIVED_TIME = 10000

export const useDepositStatusSnapshot = (params: {
  accountId: string
  chain: string
  generatedAddress: string
}) => {
  const [isDepositReceived, setIsDepositReceived] = useState<
    boolean | undefined
  >(undefined)
  const [isInitialSnapshot, setIsInitialSnapshot] = useState<boolean>(true)
  const [snapshot, setSnapshot] = useState<DepositSnapshot[]>([])
  const { data, isLoading, isFetched, refetch } = useGetDepositStatus(
    {
      account_id: params.accountId,
      chain: params.chain,
    },
    {
      enabled: !!params.generatedAddress,
    }
  )

  const checkForNewTxHashes = useCallback(
    (currentSnapshot: DepositSnapshot[], newSnapshot: DepositSnapshot[]) => {
      const currentTxHashes = new Set(
        currentSnapshot.map((depositStatus) => depositStatus.txHash)
      )
      return newSnapshot
        .filter((depositStatus) => !currentTxHashes.has(depositStatus.txHash))
        .map((depositStatus) => depositStatus.txHash)
    },
    []
  )

  const takeSnapshot = useCallback(
    (deposits: DepositStatus[]) => {
      const currentSnapshot = snapshot ?? []
      const newSnapshot = deposits.map((deposit) => ({
        txHash: deposit.tx_hash,
      }))
      const newTxHashes = checkForNewTxHashes(currentSnapshot, newSnapshot)

      if (newTxHashes.length > 0) {
        // Update the snapshot with new data
        setSnapshot([
          ...currentSnapshot,
          ...newSnapshot.filter((depositStatus) =>
            newTxHashes.includes(depositStatus.txHash)
          ),
        ])
        if (!isInitialSnapshot) {
          setIsDepositReceived(true)
          console.log("New transaction hashes found:", newTxHashes)
          setTimeout(() => {
            setIsDepositReceived(false)
          }, RESET_DEPOSIT_RECEIVED_TIME)
        }
      } else {
        console.log("No new transaction hashes found.")
      }
    },
    [snapshot, checkForNewTxHashes, isInitialSnapshot]
  )

  useEffect(() => {
    if (isFetched) {
      setIsInitialSnapshot(false)
    }
    if (data?.deposits) {
      takeSnapshot(data.deposits)
    } else {
      console.warn("Query data is undefined or deposits are missing.")
    }
  }, [data, isFetched, takeSnapshot])

  useEffect(() => {
    const intervalID = setInterval(() => {
      if (params.generatedAddress) {
        refetch()
      }
    }, INTERVAL_TIME)
    return () => clearInterval(intervalID)
  }, [params.generatedAddress, refetch])

  return {
    isDepositReceived,
    isLoading,
    snapshot,
  }
}
