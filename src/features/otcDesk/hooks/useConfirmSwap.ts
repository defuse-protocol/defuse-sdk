import { useQuery } from "@tanstack/react-query"
import { Err, Ok } from "@thames/monads"
import { providers } from "near-api-js"
import { settings } from "../../../config/settings"
import { logger } from "../../../logger"
import { getDepositedBalances } from "../../../services/defuseBalanceService"
import { quoteWithLog } from "../../../services/quoteService"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import { assert } from "../../../utils/assert"
import type { DefuseUserId } from "../../../utils/defuse"
import { getUnderlyingBaseTokenInfos } from "../../../utils/tokenUtils"
import { fillWithMinimalExchanges } from "../utils/fillWithMinimalExchanges"

export function useConfirmSwap({
  takerTokenDiff,
  takerUserId,
  tokenIn,
  protocolFee,
}: {
  takerTokenDiff: Record<string, bigint>
  takerUserId: DefuseUserId | null
  tokenIn: BaseTokenInfo | UnifiedTokenInfo
  protocolFee: number
}) {
  const allTokensIn = getUnderlyingBaseTokenInfos(tokenIn).map(
    (t) => t.defuseAssetId
  )

  useQuery({
    queryKey: ["deposited_balance_foo", takerUserId, allTokensIn],
    queryFn: async () => {
      assert(takerUserId != null)

      const balances = await getDepositedBalances(
        takerUserId,
        getUnderlyingBaseTokenInfos(tokenIn).map((t) => t.defuseAssetId),
        new providers.JsonRpcProvider({
          url: "https://nearrpc.aurora.dev",
        })
      )

      logger.verbose("balances", { balances })

      const remainingToFill = Object.entries(takerTokenDiff).reduce(
        (acc, [tokenId, amount]) => {
          if (amount < 0) {
            acc[tokenId] = -amount
          }
          return acc
        },
        {} as Record<string, bigint>
      )

      logger.verbose("remainingToFill", { remainingToFill })

      const fillResult = fillWithMinimalExchanges(
        balances,
        remainingToFill,
        BigInt(protocolFee)
      )

      logger.verbose("fillResult", { fillResult })

      if (!fillResult.success) {
        return Err("CANNOT_FILL_ORDER_DUE_TO_INSUFFICIENT_BALANCE")
      }

      const tokenDiff: [string, bigint][] = []
      const swapNeeded: {
        tokenIn: string
        tokenOut: string
        amountIn: bigint
        amountOut: bigint
      }[] = []

      for (const step of fillResult.steps) {
        tokenDiff.push([step.fromToken, -step.fromAmount])

        if (step.fromToken !== step.toToken) {
          swapNeeded.push({
            tokenIn: step.fromToken,
            tokenOut: step.toToken,
            amountIn: step.fromAmount,
            amountOut: step.toAmount,
          })
        }
      }

      const quotes = await Promise.all(
        swapNeeded.map(async ({ tokenIn, tokenOut, amountIn }) => {
          return quoteWithLog(
            {
              defuse_asset_identifier_in: tokenIn,
              defuse_asset_identifier_out: tokenOut,
              exact_amount_in: amountIn.toString(),
              min_deadline_ms: settings.quoteMinDeadlineMs,
            },
            {}
          )
        })
      )

      logger.verbose("return", { quotes, tokenDiff })
      return Ok({ quotes, tokenDiff })
    },
    enabled: takerUserId != null,
  })
}
