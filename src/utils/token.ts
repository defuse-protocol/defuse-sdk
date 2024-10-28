import type { BaseTokenInfo, UnifiedTokenInfo } from "../types/base"

export function isBaseToken(
  token: BaseTokenInfo | UnifiedTokenInfo
): token is BaseTokenInfo {
  return "defuseAssetId" in token
}

export function isUnifiedToken(
  token: BaseTokenInfo | UnifiedTokenInfo
): token is UnifiedTokenInfo {
  return "unifiedAssetId" in token
}
