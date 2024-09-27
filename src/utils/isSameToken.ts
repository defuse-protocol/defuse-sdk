import { BaseTokenInfo } from "src/types/base"

export default function isSameToken(
  token: BaseTokenInfo,
  checkToken: BaseTokenInfo
): boolean {
  return token.defuseAssetId === checkToken?.defuseAssetId
}
