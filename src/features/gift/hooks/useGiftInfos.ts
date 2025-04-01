import { useEffect, useState } from "react"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { GiftMakerHistory } from "../stores/giftMakerHistory"
import { type GiftInfo, parseGiftInfos } from "../utils/parseGiftInfos"

type UseGiftInfosReturn = {
  giftInfos: GiftInfo[] | null
  loading: boolean
  isEmpty: boolean
}

export function useGiftInfos(
  gifts: GiftMakerHistory[] | undefined,
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
): UseGiftInfosReturn {
  const [giftInfos, setGiftInfos] = useState<GiftInfo[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (gifts === undefined) {
      return
    }
    parseGiftInfos(tokenList, gifts).then((giftsResult) => {
      const filteredGifts = giftsResult
        .unwrap()
        .filter((gift) => gift.status !== "draft")
      setGiftInfos(filteredGifts)
      setLoading(false)
    })
  }, [gifts, tokenList])

  const isEmpty = giftInfos?.length === 0

  return {
    giftInfos,
    loading,
    isEmpty,
  }
}
