import { Err, Ok, type Result } from "@thames/monads"
import { providers } from "near-api-js"
import { getDepositedBalances } from "../../../services/defuseBalanceService"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import { isBaseToken, isUnifiedToken } from "../../../utils/token"
import {
  getDerivedToken,
  getUnderlyingBaseTokenInfos,
} from "../../../utils/tokenUtils"
import type { EscrowCredentials } from "./generateEscrowCredentials"

type GiftToken = {
  tokenDiff: Record<BaseTokenInfo["defuseAssetId"], bigint>
  token: BaseTokenInfo
}

export type DetermineGiftTokenErr =
  | "NO_TOKEN_OR_GIFT_HAS_BEEN_CLAIMED"
  | "ERR_GETTING_BALANCES"
  | "ERR_GETTING_DERIVED_TOKEN"

export async function determineGiftToken(
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[],
  escrowCredentials: EscrowCredentials
): Promise<Result<GiftToken, DetermineGiftTokenErr>> {
  try {
    const tokenIds = tokenList
      .flatMap((token) => getUnderlyingBaseTokenInfos(token))
      .map((t) => t.defuseAssetId)

    const balances = await getDepositedBalances(
      userAddressToDefuseUserId(
        escrowCredentials.credential,
        escrowCredentials.credentialType
      ),
      tokenIds,
      new providers.JsonRpcProvider({
        url: "https://nearrpc.aurora.dev",
      })
    )

    const tokenDiff = Object.fromEntries(
      Object.entries(balances).filter(([_, balance]) => balance > 0n)
    )
    let chainName: string | null = null
    let underlyingToken: BaseTokenInfo | UnifiedTokenInfo | null = null
    for (const token of tokenList) {
      if (isBaseToken(token) && tokenDiff[token.defuseAssetId] !== undefined) {
        chainName = token.chainName ?? null
        underlyingToken = token
        break
      }
      if (
        isUnifiedToken(token) &&
        token.groupedTokens.some(
          (t) => tokenDiff[t.defuseAssetId] !== undefined
        )
      ) {
        const validToken = token.groupedTokens.find(
          (t) => tokenDiff[t.defuseAssetId] !== undefined
        )
        if (validToken) {
          chainName = validToken.chainName ?? null
          underlyingToken = token
          break
        }
      }
    }

    if (!underlyingToken) {
      return Err("NO_TOKEN_OR_GIFT_HAS_BEEN_CLAIMED")
    }

    const derivedToken = getDerivedToken(underlyingToken, chainName)
    if (!derivedToken) {
      return Err("ERR_GETTING_DERIVED_TOKEN")
    }

    return Ok({
      tokenDiff,
      token: derivedToken,
    })
  } catch {
    return Err("ERR_GETTING_BALANCES")
  }
}
