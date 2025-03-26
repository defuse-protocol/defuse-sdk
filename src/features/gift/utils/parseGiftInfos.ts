import { Ok, type Result } from "@thames/monads"
import type { BaseTokenInfo, UnifiedTokenInfo } from "src/types/base"
import { logger } from "../../../logger"
import type { GiftMakerHistory } from "../stores/giftMakerHistory"
import { determineGiftToken } from "./determineGiftToken"
import { parseEscrowCredentials } from "./generateEscrowCredentials"

export type GiftInfos = {
  pending: GiftMakerHistory[]
  claimed: GiftMakerHistory[]
  failed: GiftMakerHistory[]
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
        // If returns an error, it means the escrow account no longer
        // has the gifted token balance, indicating the gift has been claimed
        if (determineResult.isErr()) {
          return createTaggedGift(gift, "claimed")
        }
        return createTaggedGift(gift, "pending")
      } catch (err: unknown) {
        logger.error(new Error("error parsing gift info", { cause: err }))
        return createTaggedGift(gift, "failed")
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
  gift: GiftMakerHistory,
  status: FilterStatus
): GiftMakerHistory & { status: FilterStatus } {
  return { ...gift, status }
}

type FilterStatus = "pending" | "claimed" | "failed"
function filterByStatus(
  status: FilterStatus,
  giftInfos: Array<GiftMakerHistory & { status: FilterStatus }>
): GiftMakerHistory[] {
  return giftInfos.filter((giftInfo) => giftInfo.status === status)
}

function sortByDate(giftInfos: GiftMakerHistory[]): GiftMakerHistory[] {
  return giftInfos.sort((a, b) => b.updatedAt - a.updatedAt)
}
