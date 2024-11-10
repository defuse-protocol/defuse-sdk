import { useCallback, useEffect, useRef, useState } from "react"
import type { DepositStatus } from "src/services/poaBridgeClient/types"
import { BlockchainEnum, type DepositSnapshot } from "src/types"
import { useGetDepositStatus } from "./usePoABridge"

const INTERVAL_TIME = 1000 // 1 second
const RESET_DEPOSIT_RECEIVED_TIME = 10000 // 10 seconds

export const useDepositStatusSnapshot = (params: {
  accountId: string
  chain: string
  generatedAddress: string
}) => {
  const [isDepositReceived, setIsDepositReceived] = useState<
    boolean | undefined
  >(undefined)
  const [initializedSnapshot, setInitializedSnapshot] = useState<boolean>(true)
  const [snapshot, setSnapshot] = useState<DepositSnapshot[]>([])
  const { data, isLoading, refetch, isFetched } = useGetDepositStatus(
    {
      account_id: params.accountId,
      chain: params.chain,
    },
    {
      enabled:
        !!params.generatedAddress &&
        params.chain !== BlockchainEnum.NEAR &&
        !!params.accountId,
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
        if (!initializedSnapshot) {
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
    [snapshot, checkForNewTxHashes, initializedSnapshot]
  )

  useEffect(() => {
    if (data?.deposits) {
      takeSnapshot(data.deposits)
    }
    if (isFetched) {
      setInitializedSnapshot(false)
    }
  }, [data, takeSnapshot, isFetched])

  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (params.generatedAddress && params.chain && !!params.accountId) {
        refetch()
      }
    }, INTERVAL_TIME)
    return () => clearInterval(intervalRef.current)
  }, [params.generatedAddress, params.chain, refetch, params.accountId])

  useEffect(() => {
    if (
      (params.chain === BlockchainEnum.NEAR && intervalRef.current) ||
      (!params.chain && intervalRef.current)
    ) {
      clearInterval(intervalRef.current)
    }
  }, [params.chain])

  return {
    isDepositReceived,
    isLoading,
    snapshot,
  }
}
