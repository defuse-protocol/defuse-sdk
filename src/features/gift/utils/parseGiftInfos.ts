import { Ok, type Result } from "@thames/monads"
import type { BaseTokenInfo, UnifiedTokenInfo } from "src/types/base"
import { logger } from "../../../logger"
import { assert } from "../../../utils/assert"
import type { GiftMakerHistory } from "../stores/giftMakerHistory"
import { deriveToken } from "./deriveToken"
import { determineGiftToken } from "./determineGiftToken"
import { parseEscrowCredentials } from "./generateEscrowCredentials"

export type GiftInfos = {
  pending: GiftInfo[]
  claimed: GiftInfo[]
  failed: GiftInfo[]
}

export type GiftInfo = GiftMakerHistory & {
  status: FilterStatus
  token: BaseTokenInfo | UnifiedTokenInfo
}

export async function parseGiftInfos(
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[],
  gifts: GiftMakerHistory[]
): Promise<Result<GiftInfos, Error>> {
  const giftInfos = await Promise.all(
    gifts.map(async (gift) => {
      try {
        const escrowCredentials = parseEscrowCredentials(gift.secretKey)
        const determineResult = await determineGiftToken(
          tokenList,
          escrowCredentials
        )

        // For backward compatibility with versions, we try to extract the token from the structure
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        const tokenFromV0 = (gift as any)?.token as
          | BaseTokenInfo
          | UnifiedTokenInfo
        const tokenFromLatest = gift?.tokenId
          ? deriveToken(gift.tokenId, tokenList)
          : undefined

        const token = tokenFromV0 ?? tokenFromLatest

        // If returns an error, it means the escrow account no longer
        // has the gifted token balance, indicating the gift has been claimed
        if (determineResult.isErr()) {
          return createTaggedGift("claimed", gift, token)
        }
        return createTaggedGift("pending", gift, token)
      } catch (err: unknown) {
        logger.error(new Error("error parsing gift info", { cause: err }))
        assert(tokenList[0], "tokenList[0] is not undefined")
        return createTaggedGift("failed", gift, tokenList[0])
      }
    })
  )
  return Ok({
    pending: sortByDate(filterByStatus("pending", giftInfos)),
    claimed: sortByDate(filterByStatus("claimed", giftInfos)),
    failed: sortByDate(filterByStatus("failed", giftInfos)),
  })
}

function createTaggedGift(
  status: FilterStatus,
  gift: GiftMakerHistory,
  token: BaseTokenInfo | UnifiedTokenInfo
): GiftInfo {
  return { ...gift, status, token }
}

type FilterStatus = "pending" | "claimed" | "failed"
function filterByStatus(
  status: FilterStatus,
  giftInfos: Array<GiftInfo>
): GiftInfo[] {
  return giftInfos.filter((giftInfo) => giftInfo.status === status)
}

function sortByDate(giftInfos: GiftInfo[]): GiftInfo[] {
  return giftInfos.sort((a, b) => b.updatedAt - a.updatedAt)
}
