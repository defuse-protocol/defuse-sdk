import { useEffect, useState } from "react"
import { useSolverLiquidityQuery } from "../../../../../queries/solverLiquidityQuerires"

export const useLiquidityData = () => {
  const [liquidityData, setLiquidityData] = useState<Record<
    string,
    bigint
  > | null>({})

  const { data, isLoading } = useSolverLiquidityQuery()

  useEffect(() => {
    if (!isLoading && data) {
      const liquidityData_: Record<string, bigint> = {}

      for (const { address_from, address_to, validated_amount } of data) {
        liquidityData_[`${address_from}#${address_to}`] =
          BigInt(validated_amount)
      }

      setLiquidityData(liquidityData_)
    }
  }, [data, isLoading])

  return liquidityData
}
