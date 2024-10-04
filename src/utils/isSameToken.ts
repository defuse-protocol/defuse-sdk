import type { BaseTokenInfo } from "../types/base"

export const isSameToken = (
  token: BaseTokenInfo,
  checkToken: BaseTokenInfo
): boolean => {
  return token.defuseAssetId === checkToken?.defuseAssetId
}
