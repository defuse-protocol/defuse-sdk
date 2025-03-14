import { Err, Ok, type Result } from "@thames/monads"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import { determineGiftToken } from "./determineGiftToken"
import { deriveAccountId, parseGiftSecret } from "./parseGiftSecret"

export type GiftInfo = {
  tokenDiff: Record<BaseTokenInfo["defuseAssetId"], bigint>
  token: BaseTokenInfo | UnifiedTokenInfo
  secretKey: string
  accountId: string
}

export async function getGiftInfo(
  secretKey: string,
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
): Promise<Result<GiftInfo, string>> {
  const parseResult = parseGiftSecret(secretKey)
  if (parseResult.isErr()) {
    return Err(parseResult.unwrapErr())
  }

  const accountId = deriveAccountId(parseResult.unwrap().secretKey)
  const determineResult = await determineGiftToken(tokenList, accountId)
  if (determineResult.isErr()) {
    return Err(determineResult.unwrapErr())
  }

  return Ok({
    tokenDiff: determineResult.unwrap().tokenDiff,
    token: determineResult.unwrap().token,
    secretKey: parseResult.unwrap().secretKey,
    accountId: accountId,
  })
}
