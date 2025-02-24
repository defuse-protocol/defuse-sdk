import { useMutation, useQuery } from "@tanstack/react-query"
import { Err, Ok, type Result } from "@thames/monads"
import { providers } from "near-api-js"
import { settings } from "../../../config/settings"
import {
  type SignerCredentials,
  formatSignedIntent,
} from "../../../core/formatters"
import { createSwapIntentMessage } from "../../../core/messages"
import { logger } from "../../../logger"
import { getDepositedBalances } from "../../../services/defuseBalanceService"
import {
  type AggregatedQuote,
  isFailedQuote,
  quoteWithLog,
} from "../../../services/quoteService"
import { publishIntents } from "../../../services/solverRelayHttpClient"
import type { FailedQuote } from "../../../services/solverRelayHttpClient/types"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import { assert } from "../../../utils/assert"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import { getUnderlyingBaseTokenInfos } from "../../../utils/tokenUtils"
import type { SignMessage } from "../types/sharedTypes"
import { fillWithMinimalExchanges } from "../utils/fillWithMinimalExchanges"

export function useConfirmSwap({
  makerMultiPayloadPlain,
  takerTokenDiff,
  tokenIn,
  protocolFee,
  signMessage,
  signerCredentials,
}: {
  makerMultiPayloadPlain: MultiPayload | string
  takerTokenDiff: Record<string, bigint>
  tokenIn: BaseTokenInfo | UnifiedTokenInfo
  protocolFee: number
  signMessage: SignMessage
  signerCredentials: SignerCredentials | null
}) {
  const signerId =
    signerCredentials != null
      ? userAddressToDefuseUserId(
          signerCredentials.credential,
          signerCredentials.credentialType
        )
      : null

  const allTokensIn = getUnderlyingBaseTokenInfos(tokenIn).map(
    (t) => t.defuseAssetId
  )

  const details = useQuery({
    queryKey: ["deposited_balance_foo", signerId, allTokensIn],
    queryFn: async () => {
      assert(signerId != null)

      const balances = await getDepositedBalances(
        signerId,
        getUnderlyingBaseTokenInfos(tokenIn).map((t) => t.defuseAssetId),
        new providers.JsonRpcProvider({
          url: "https://nearrpc.aurora.dev",
        })
      )

      logger.verbose("balances", { balances })

      const receivedTokenDiff = Object.entries(takerTokenDiff).reduce(
        (acc, [tokenId, amount]) => {
          if (amount > 0) {
            acc[tokenId] = amount
          }
          return acc
        },
        {} as Record<string, bigint>
      )

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
        return Err({
          reason: "CANNOT_FILL_ORDER_DUE_TO_INSUFFICIENT_BALANCE" as const,
        })
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

      tokenDiff.push(...Object.entries(receivedTokenDiff))

      const quotesResult = await manyQuotes(swapNeeded)

      return quotesResult.map((quotes) => {
        logger.verbose("return", { quotes, tokenDiff })
        return { quotes, tokenDiff }
      })
    },
    enabled: signerId != null,
  })

  return useMutation({
    mutationKey: ["confirm_swap", signerId],
    mutationFn: async () => {
      if (details.data == null) {
        throw new Error("No details")
      }

      if (signerCredentials == null) {
        throw new Error("No signerCredentials")
      }

      const detailsData = details.data.unwrap()
      const quoteHashes = detailsData.quotes.flatMap((q) => q.quoteHashes)

      const walletMessage = createSwapIntentMessage(detailsData.tokenDiff, {
        signerId: userAddressToDefuseUserId(
          signerCredentials.credential,
          signerCredentials.credentialType
        ),
      })
      const signatureResult = await signMessage(walletMessage)
      if (signatureResult == null) {
        throw new Error("Didn't sign or failed")
      }

      const multiPayload = formatSignedIntent(
        signatureResult,
        signerCredentials
      )

      const result = await publishIntents({
        quote_hashes: quoteHashes,
        signed_datas: [
          multiPayload,
          typeof makerMultiPayloadPlain === "string"
            ? JSON.parse(makerMultiPayloadPlain)
            : makerMultiPayloadPlain,
        ],
      }).then(parsePublishIntentsResponse)

      return result.unwrap()
    },
  })
}

function parsePublishIntentsResponse(
  response: Awaited<ReturnType<typeof publishIntents>>
) {
  if (response.status === "OK") {
    return Ok(response.intent_hashes)
  }

  if (response.reason === "already processed") {
    return Ok(response.intent_hashes)
  }

  if (
    response.reason === "expired" ||
    response.reason.includes("deadline has expired")
  ) {
    return Err({ reason: "RELAY_PUBLISH_SIGNATURE_EXPIRED" })
  }

  if (response.reason === "internal") {
    return Err({ reason: "RELAY_PUBLISH_INTERNAL_ERROR" })
  }

  if (response.reason.includes("invalid signature")) {
    return Err({ reason: "RELAY_PUBLISH_SIGNATURE_INVALID" })
  }

  if (response.reason.includes("nonce was already used")) {
    return Err({ reason: "RELAY_PUBLISH_NONCE_USED" })
  }

  return Err({
    reason: "RELAY_PUBLISH_UNKNOWN_ERROR",
    serverReason: response.reason,
  })
}

async function manyQuotes(
  swapParams: {
    tokenIn: string
    tokenOut: string
    amountIn: bigint
  }[]
): Promise<Result<AggregatedQuote[], AggregateQuoteErrs>> {
  const quoteResults = await Promise.all(
    swapParams.map(async ({ tokenIn, tokenOut, amountIn }) => {
      return quoteWithLog(
        {
          defuse_asset_identifier_in: tokenIn,
          defuse_asset_identifier_out: tokenOut,
          exact_amount_in: amountIn.toString(),
          min_deadline_ms: settings.quoteMinDeadlineMs,
        },
        {}
      ).then(handleQuote)
    })
  )

  const quoteErr = quoteResults.find((q) => q.isErr())
  if (quoteErr) {
    return Err(quoteErr.unwrapErr())
  }

  const quotes = quoteResults.map((q) => q.unwrap())

  return Ok(quotes)
}

type AggregateQuoteErrs =
  | { reason: "NO_QUOTES" }
  | { reason: "INSUFFICIENT_AMOUNT"; minAmount: bigint }

function handleQuote(
  quotes: Awaited<ReturnType<typeof quoteWithLog>>
): Result<AggregatedQuote, AggregateQuoteErrs> {
  if (quotes == null) {
    return Err({ reason: "NO_QUOTES" })
  }

  const failedQuotes: FailedQuote[] = []
  const validQuotes = []
  for (const q of quotes) {
    if (isFailedQuote(q)) {
      failedQuotes.push(q)
    } else {
      validQuotes.push(q)
    }
  }

  validQuotes.sort((a, b) => {
    // Sort by `amount_in` in ascending order, because backend does not sort
    if (BigInt(a.amount_in) < BigInt(b.amount_in)) return -1
    if (BigInt(a.amount_in) > BigInt(b.amount_in)) return 1
    return 0
  })

  const bestQuote = validQuotes[0]
  if (bestQuote) {
    return Ok({
      quoteHashes: [bestQuote.quote_hash],
      expirationTime: bestQuote.expiration_time,
      tokenDeltas: [
        [bestQuote.defuse_asset_identifier_in, -BigInt(bestQuote.amount_in)],
        [bestQuote.defuse_asset_identifier_out, BigInt(bestQuote.amount_out)],
      ],
    })
  }

  const failedQuote = failedQuotes[0]
  if (failedQuote) {
    return Err({
      reason: failedQuote.type,
      minAmount: BigInt(failedQuote.min_amount),
    })
  }

  return Err({ reason: "NO_QUOTES" })
}
