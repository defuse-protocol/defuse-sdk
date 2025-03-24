import { useQuery } from "@tanstack/react-query"
import { Err, type Result } from "@thames/monads"
import { providers } from "near-api-js"
import { logger } from "../../../logger"
import { getDepositedBalances } from "../../../services/defuseBalanceService"
import type { AggregatedQuote } from "../../../services/quoteService"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import { assert } from "../../../utils/assert"
import type { DefuseUserId } from "../../../utils/defuse"
import { getUnderlyingBaseTokenInfos } from "../../../utils/tokenUtils"
import { fillWithMinimalExchanges } from "../utils/fillWithMinimalExchanges"
import {
  type AggregatedQuoteErr,
  type QuoteExactInParams,
  manyQuotes,
} from "../utils/quoteUtils"

export type OTCTakerPreparationOk = {
  quotes: AggregatedQuote[]
  quoteParams: QuoteExactInParams[]
  tokenDelta: [string, bigint][]
}

export type OTCTakerPreparationErr = { reason: string } | AggregatedQuoteErr

export type OTCTakerPreparationResult = Result<
  OTCTakerPreparationOk,
  OTCTakerPreparationErr
>

export function useOtcTakerPreparation({
  tokenIn,
  takerTokenDiff,
  protocolFee,
  takerId,
}: {
  tokenIn: BaseTokenInfo | UnifiedTokenInfo
  takerTokenDiff: Record<string, bigint>
  protocolFee: number
  takerId: DefuseUserId | null
}) {
  return useQuery({
    enabled: takerId != null,
    queryKey: ["otc_taker_preparation", takerId],
    queryFn: async (): Promise<OTCTakerPreparationResult> => {
      assert(takerId != null)

      const balances = await getDepositedBalances(
        takerId,
        getUnderlyingBaseTokenInfos(tokenIn).map((t) => t.defuseAssetId),
        new providers.JsonRpcProvider({
          url: "https://nearrpc.aurora.dev",
        })
      )

      logger.verbose("balances", { balances })

      const tokensToReceive: Record<string, bigint> = {}
      const tokensToSend: Record<string, bigint> = {}

      for (const [tokenId, amount] of Object.entries(takerTokenDiff)) {
        if (amount > 0n) {
          tokensToReceive[tokenId] = amount
        } else if (amount < 0n) {
          tokensToSend[tokenId] = -amount
        }
      }

      logger.verbose("tokens breakdown", { tokensToReceive, tokensToSend })

      const fillResult = fillWithMinimalExchanges(
        balances,
        tokensToSend,
        BigInt(protocolFee)
      )

      logger.verbose("fillResult", { fillResult })

      if (!fillResult.success) {
        return Err({
          reason: "CANNOT_FILL_ORDER_DUE_TO_INSUFFICIENT_BALANCE" as const,
        })
      }

      const tokenDelta: [string, bigint][] = Object.entries(tokensToReceive)
      const quoteParams: QuoteExactInParams[] = []

      for (const step of fillResult.steps) {
        tokenDelta.push([step.fromToken, -step.fromAmount])

        if (step.fromToken !== step.toToken) {
          quoteParams.push({
            tokenIn: step.fromToken,
            tokenOut: step.toToken,
            amountIn: step.fromAmount,
          })
        }
      }

      const quotesResult = await manyQuotes(quoteParams)

      return quotesResult.map((quotes) => {
        logger.verbose("return", { quotes, quoteParams, tokenDelta })
        return { quotes, quoteParams, tokenDelta }
      })
    },
  })
}
