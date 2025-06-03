import { useQuery } from "@tanstack/react-query"
import { getSolverLiquidityRequest } from "../sdk/poaBridge/intentHttpClient/api"

export function useSolverLiquidityQuery() {
  return useQuery({
    queryKey: ["solver_liquidity"],
    queryFn: getSolverLiquidityRequest,
  })
}
