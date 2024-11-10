import { useQuery } from "@tanstack/react-query"
import { getDepositStatus } from "src/services/poaBridgeClient"

const queryKey = "poa-bridge"

export const getDepositStatusKey = [queryKey, "get-deposit-status"]

export const useGetDepositStatus = (
  params: { account_id: string; chain: string },
  options = {}
) =>
  useQuery({
    queryKey: getDepositStatusKey,
    queryFn: () => getDepositStatus(params),
    ...options,
  })
