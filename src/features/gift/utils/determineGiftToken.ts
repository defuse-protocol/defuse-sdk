import { Err, Ok, type Result } from "@thames/monads"
import { providers } from "near-api-js"
import { getDepositedBalances } from "../../../services/defuseBalanceService"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import { isBaseToken } from "../../../utils/token"
import { getAnyBaseTokenInfo } from "../../../utils/tokenUtils"
import type { GiftSecret } from "./parseGiftSecret"

type GiftToken = {
  tokenInDiff: Record<BaseTokenInfo["defuseAssetId"], bigint>
  tokenIn: BaseTokenInfo
}

export async function determineGiftToken(
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[],
  giftSecret: GiftSecret
): Promise<Result<GiftToken, string>> {
  try {
    const tokenIds = tokenList.flatMap((token) => {
      return isBaseToken(token)
        ? [token.defuseAssetId]
        : token.groupedTokens.map((t) => t.defuseAssetId)
    })

    const balances = await getDepositedBalances(
      userAddressToDefuseUserId(giftSecret.walletId, "near"),
      tokenIds,
      new providers.JsonRpcProvider({
        url: "https://nearrpc.aurora.dev",
      })
    )

    // Currently there will be only one token with balance, but in future we may support multiple tokens in a gift
    const tokenInDiff = Object.fromEntries(
      Object.entries(balances).filter(([_, balance]) => balance > 0n)
    )
    const tokenIn_ = tokenList.find((token) =>
      isBaseToken(token)
        ? tokenInDiff[token.defuseAssetId] !== undefined
        : token.groupedTokens.some(
            (gt) => tokenInDiff[gt.defuseAssetId] !== undefined
          )
    )

    if (!tokenIn_) {
      return Err("NO_BALANCE_OR_GIFT_HAS_BEEN_TAKEN")
    }

    const tokenIn = getAnyBaseTokenInfo(tokenIn_)

    return Ok({
      tokenInDiff,
      tokenIn,
    })
  } catch (error) {
    return Err(
      `ERR_GETTING_BALANCES: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
