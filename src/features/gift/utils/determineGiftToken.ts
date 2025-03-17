import { Err, Ok, type Result } from "@thames/monads"
import { providers } from "near-api-js"
import { getDepositedBalances } from "../../../services/defuseBalanceService"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import { isBaseToken } from "../../../utils/token"
import {
  getAnyBaseTokenInfo,
  getUnderlyingBaseTokenInfos,
} from "../../../utils/tokenUtils"

type GiftToken = {
  tokenDiff: Record<BaseTokenInfo["defuseAssetId"], bigint>
  token: BaseTokenInfo
}

export type DetermineGiftTokenErr =
  | "NO_TOKEN_OR_GIFT_HAS_BEEN_CLAIMED"
  | "ERR_GETTING_BALANCES"

export async function determineGiftToken(
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[],
  accountId: string
): Promise<Result<GiftToken, DetermineGiftTokenErr>> {
  try {
    const tokenIds = tokenList
      .flatMap((token) => getUnderlyingBaseTokenInfos(token))
      .map((t) => t.defuseAssetId)

    const balances = await getDepositedBalances(
      userAddressToDefuseUserId(accountId, "near"),
      tokenIds,
      new providers.JsonRpcProvider({
        url: "https://nearrpc.aurora.dev",
      })
    )

    const tokenDiff = Object.fromEntries(
      Object.entries(balances).filter(([_, balance]) => balance > 0n)
    )
    const token_ = tokenList.find((token) =>
      isBaseToken(token)
        ? tokenDiff[token.defuseAssetId] !== undefined
        : token.groupedTokens.some(
            (gt) => tokenDiff[gt.defuseAssetId] !== undefined
          )
    )

    if (!token_) {
      return Err("NO_TOKEN_OR_GIFT_HAS_BEEN_CLAIMED")
    }

    const token = getAnyBaseTokenInfo(token_)

    return Ok({
      tokenDiff,
      token,
    })
  } catch {
    return Err("ERR_GETTING_BALANCES")
  }
}
