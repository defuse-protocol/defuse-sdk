import { config as globalConfig } from "../../../config"
import { request } from "../../../utils/request"
import type { GetSolverLiquidityResponse } from "./types"

export async function getSolverLiquidityRequest(): Promise<
  GetSolverLiquidityResponse[]
> {
  const response = await await request({
    url: `${globalConfig.env.nearIntentsBaseURL}/solver_liquidity`,
    fetchOptions: {
      method: "GET",
    },
  })

  return response.json()
}
