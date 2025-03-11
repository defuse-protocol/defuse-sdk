import { Err, Ok, type Result } from "@thames/monads"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import { determineGiftToken } from "./determineGiftToken"
import { parseGiftSecret } from "./parseGiftSecret"

export type GiftTerms = {
  tokenDiff: Record<BaseTokenInfo["defuseAssetId"], bigint>
  token: BaseTokenInfo | UnifiedTokenInfo
  secretKey: string
  userId: string
}

export async function deriveGiftTerms(
  secretKey: string,
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
): Promise<Result<GiftTerms, string>> {
  const parseResult = parseGiftSecret(secretKey)
  if (parseResult.isErr()) {
    return Err(parseResult.unwrapErr())
  }

  const determineResult = await determineGiftToken(
    tokenList,
    parseResult.unwrap().userId
  )
  if (determineResult.isErr()) {
    return Err(determineResult.unwrapErr())
  }

  return Ok({
    tokenDiff: determineResult.unwrap().tokenDiff,
    token: determineResult.unwrap().token,
    secretKey: parseResult.unwrap().secretKey,
    userId: parseResult.unwrap().userId,
  })
}
