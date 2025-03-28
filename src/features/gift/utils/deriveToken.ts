import type { BaseTokenInfo, UnifiedTokenInfo } from "src/types/base"
import { isUnifiedToken } from "../../../utils/token"

export function deriveTokenId(token: BaseTokenInfo | UnifiedTokenInfo) {
  if (isUnifiedToken(token)) {
    return token.unifiedAssetId
  }
  return token.defuseAssetId
}

export function deriveToken(
  tokenId: string,
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
) {
  const result = tokenList.find((t) => deriveTokenId(t) === tokenId)
  if (!result) {
    throw new Error(`Token not found: ${tokenId}`)
  }
  return result
}
