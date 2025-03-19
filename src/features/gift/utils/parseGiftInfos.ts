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
          return {
            tag: "claimed",
            ...gift,
          }
        }
        return {
          tag: "pending",
          ...gift,
        }
      } catch (err: unknown) {
        logger.error(new Error("error parsing gift info", { cause: err }))
        return {
          tag: "failed",
          ...gift,
        }
      }
    })
  )
  return Ok({
    pending: giftInfos.filter((giftInfo) => giftInfo.tag === "pending"),
    claimed: giftInfos.filter((giftInfo) => giftInfo.tag === "claimed"),
    failed: giftInfos.filter((giftInfo) => giftInfo.tag === "failed"),
  })
}
