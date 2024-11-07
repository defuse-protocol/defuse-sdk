import { useCallback, useEffect, useRef, useState } from "react"
import type { DepositStatus } from "src/services/poaBridgeClient/types"
import { BlockchainEnum, type DepositSnapshot } from "src/types"
import { useGetDepositStatus } from "./usePoABridge"

const INTERVAL_TIME = 1000 // 1 second
const INITIALIZATION_DEPOSIT_RECEIVED_TIMEOUT = 15000 // 15 seconds
const RESET_DEPOSIT_RECEIVED_TIME = 10000 // 10 seconds

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
  const { data, isLoading, refetch } = useGetDepositStatus(
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
    if (data?.deposits) {
      takeSnapshot(data.deposits)
    } else {
      console.warn("Query data is undefined or deposits are missing.")
    }
    setTimeout(() => {
      setIsInitialSnapshot(false)
    }, INITIALIZATION_DEPOSIT_RECEIVED_TIMEOUT)
  }, [data, takeSnapshot])

  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (params.generatedAddress && params.chain !== BlockchainEnum.NEAR) {
        refetch()
      }
    }, INTERVAL_TIME)
    return () => clearInterval(intervalRef.current)
  }, [params.generatedAddress, params.chain, refetch])

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
