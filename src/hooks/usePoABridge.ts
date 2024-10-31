import { useQuery } from "@tanstack/react-query"
import { getSupportedTokens } from "src/services/poaBridgeClient"
import type { BlockchainEnum } from "src/types"

const queryKey = "poa-bridge"

export const getSupportedTokensKey = [queryKey, "get-supported-tokens"]

// TODO: Probably we don't need this hook
export const useGetSupportedTokens = (
  params: { chains?: BlockchainEnum[] },
  options = {}
) =>
  useQuery({
    queryKey: getSupportedTokensKey,
    queryFn: () => getSupportedTokens(params),
    ...options,
  })
