import { useSolverLiquidityQuery } from "../../../../../queries/solverLiquidityQuerires"

export const useLiquidityData = () => {
  const { data: liquidityData } = useSolverLiquidityQuery()

  return liquidityData
}
