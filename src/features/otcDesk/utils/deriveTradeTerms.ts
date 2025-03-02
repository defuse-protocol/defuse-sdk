import { Err, Ok, type Result } from "@thames/monads"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import type { DefuseUserId } from "../../../utils/defuse"
import { isBaseToken } from "../../../utils/token"
import { grossUpAmount, netDownAmount } from "./otcMakerBreakdown"
import { parseTradeTerms } from "./parseTradeTerms"

export type TradeTerms = {
  deadline: string
  makerUserId: DefuseUserId
  makerTokenDiff: Record<BaseTokenInfo["defuseAssetId"], bigint>
  makerNonceBase64: string
  takerTokenDiff: Record<BaseTokenInfo["defuseAssetId"], bigint>
  tokenIn: BaseTokenInfo | UnifiedTokenInfo
  tokenOut: BaseTokenInfo | UnifiedTokenInfo
  makerMultiPayload: MultiPayload
}

export function deriveTradeTerms(
  makerMultiPayload: MultiPayload | string,
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[],
  fee: number
): Result<TradeTerms, string> {
  const makerTermsResult = parseTradeTerms(makerMultiPayload)

  return makerTermsResult.andThen((makerTerms) => {
    const takerTermsResult = determineOppositeSideTradeDetails(
      tokenList,
      makerTerms.tokenDiff,
      fee
    )

    return takerTermsResult.map(({ oppositeTokenDiff, tokenIn, tokenOut }) => ({
      deadline: makerTerms.deadline,
      makerUserId: makerTerms.userId,
      makerTokenDiff: makerTerms.tokenDiff,
      makerNonceBase64: makerTerms.nonceBase64,
      takerTokenDiff: oppositeTokenDiff,
      tokenIn,
      tokenOut,
      makerMultiPayload: makerTerms.multiPayload,
    }))
  })
}

function determineOppositeSideTradeDetails(
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[],
  tokenDiff: Record<BaseTokenInfo["defuseAssetId"], bigint>,
  fee: number
) {
  const oppositeTokenDiff = computeOppositeSideTokenDiff(tokenDiff, fee)
  const { tokenIdsIn, tokenIdsOut } = getTokenIds(oppositeTokenDiff)
  const tokensResult = determineTokenInAndOut(
    tokenList,
    tokenIdsIn,
    tokenIdsOut
  )

  return tokensResult.map(({ tokenIn, tokenOut }) => ({
    oppositeTokenDiff,
    tokenIn,
    tokenOut,
  }))
}

function computeOppositeSideTokenDiff(
  tokenDiff: Record<BaseTokenInfo["defuseAssetId"], bigint>,
  fee: number
) {
  const oppositeTokenDiff: Record<BaseTokenInfo["defuseAssetId"], bigint> = {}

  for (const [tokenId, makerAmount] of Object.entries(tokenDiff)) {
    const takerAmount =
      makerAmount > 0n
        ? grossUpAmount(makerAmount, fee)
        : netDownAmount(makerAmount, fee)

    oppositeTokenDiff[tokenId] = -takerAmount
  }

  return oppositeTokenDiff
}

function getTokenIds(
  tokenDiff: Record<BaseTokenInfo["defuseAssetId"], bigint>
) {
  const tokenIdsIn: BaseTokenInfo["defuseAssetId"][] = []
  const tokenIdsOut: BaseTokenInfo["defuseAssetId"][] = []

  for (const [tokenId, amount] of Object.entries(tokenDiff)) {
    if (amount > 0n) {
      tokenIdsOut.push(tokenId)
    } else if (amount < 0n) {
      tokenIdsIn.push(tokenId)
    }
  }

  return { tokenIdsIn, tokenIdsOut }
}

function findTokens(
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[],
  tokenIds: BaseTokenInfo["defuseAssetId"][]
): (BaseTokenInfo | UnifiedTokenInfo | null)[] {
  const tokens = tokenIds.map((tokenId) => {
    const found = tokenList.find((token) => {
      if (isBaseToken(token)) {
        return token.defuseAssetId === tokenId
      }

      return token.groupedTokens.some(
        (group) => group.defuseAssetId === tokenId
      )
    })

    return found ?? null
  })

  return Array.from(new Set(tokens))
}

function determineTokenInAndOut(
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[],
  tokenIdsIn: BaseTokenInfo["defuseAssetId"][],
  tokenIdsOut: BaseTokenInfo["defuseAssetId"][]
): Result<
  {
    tokenIn: BaseTokenInfo | UnifiedTokenInfo
    tokenOut: BaseTokenInfo | UnifiedTokenInfo
  },
  "MULTIPLE_TOKENS_NOT_SUPPORTED" | "TOKEN_NOT_FOUND_IN_LIST"
> {
  const tokensIn = findTokens(tokenList, tokenIdsIn)
  const tokensOut = findTokens(tokenList, tokenIdsOut)

  // We need to ensure that each group of tokens are resolved into a single token,
  // otherwise it means user needs to sell multiple tokens or buy multiple tokens
  if (tokensIn.length !== 1 || tokensOut.length !== 1) {
    return Err("MULTIPLE_TOKENS_NOT_SUPPORTED")
  }

  const tokenIn = tokensIn[0]
  const tokenOut = tokensOut[0]

  if (tokenIn == null || tokenOut == null) {
    return Err("TOKEN_NOT_FOUND_IN_LIST")
  }

  return Ok({ tokenIn, tokenOut })
}
