import { Ok, type Result } from "@thames/monads"
import type { BaseTokenInfo, UnifiedTokenInfo } from "src/types/base"
import { logger } from "../../../logger"
import { assert } from "../../../utils/assert"
import type { GiftMakerHistory } from "../stores/giftMakerHistory"
import { findTokenFromDiff } from "./deriveToken"
import { determineGiftToken } from "./determineGiftToken"
import { parseEscrowCredentials } from "./generateEscrowCredentials"

export type GiftInfos = {
  pending: GiftInfo[]
  claimed: GiftInfo[]
  nonExistent: GiftInfo[]
}

export type GiftInfo = GiftMakerHistory & {
  status: FilterStatus
  accountId: string
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
        const token = findTokenFromDiff(gift.tokenDiff, tokenList)
        const escrowAccountBalance = determineResult.isOk()
        const giftStatus = getGiftStatus(gift, escrowAccountBalance)
        if (giftStatus === "pending") {
          return createTaggedGift(
            giftStatus,
            gift,
            token,
            escrowCredentials.credential
          )
        }
        if (giftStatus === "claimed") {
          return createTaggedGift(
            giftStatus,
            gift,
            token,
            escrowCredentials.credential
          )
        }
        return createTaggedGift(
          "non-existent",
          gift,
          token,
          escrowCredentials.credential
        )
      } catch (err: unknown) {
        logger.error(new Error("error parsing gift info", { cause: err }))
        assert(tokenList[0], "tokenList[0] is not undefined")
        return createTaggedGift("non-existent", gift, tokenList[0], "dontcare")
      }
    })
  )
  return Ok({
    pending: sortByDate(filterByStatus("pending", giftInfos)),
    claimed: sortByDate(filterByStatus("claimed", giftInfos)),
    nonExistent: sortByDate(filterByStatus("non-existent", giftInfos)),
  })
}

function createTaggedGift(
  status: FilterStatus,
  gift: GiftMakerHistory,
  token: BaseTokenInfo | UnifiedTokenInfo,
  accountId: string
): GiftInfo {
  return { ...gift, status, token, accountId }
}

function filterByStatus(
  status: FilterStatus,
  giftInfos: Array<GiftInfo>
): GiftInfo[] {
  return giftInfos.filter((giftInfo) => giftInfo.status === status)
}

function sortByDate(giftInfos: GiftInfo[]): GiftInfo[] {
  return giftInfos.sort((a, b) => b.updatedAt - a.updatedAt)
}

type FilterStatus = "draft" | "pending" | "claimed" | "non-existent"

function getGiftStatus(
  gift: GiftMakerHistory,
  escrowAccountBalance: boolean
): FilterStatus {
  const createdAt = gift.createdAt
  const updatedAt = gift.updatedAt

  // Case 1: `draft` Gift is stored in storage but not yet published
  if (createdAt === updatedAt && !escrowAccountBalance) return "draft"

  // Case 2: `pending` Gift is stored in storage and funds have been transferred to the escrow account
  if (createdAt === updatedAt && escrowAccountBalance) return "pending"
  if (createdAt !== updatedAt && escrowAccountBalance) return "pending"

  // Case 3: `claimed` Gift has been published and funds have been claimed from the escrow account
  if (createdAt !== updatedAt && !escrowAccountBalance) return "claimed"

  return "non-existent"
}
