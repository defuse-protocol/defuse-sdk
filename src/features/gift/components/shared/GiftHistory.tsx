import { useEffect, useMemo, useState } from "react"
import { ButtonCustom } from "../../../../components/Button/ButtonCustom"
import type { SignerCredentials } from "../../../../core/formatters"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../../types/base"
import { userAddressToDefuseUserId } from "../../../../utils/defuse"
import { GiftClaimActorProvider } from "../../providers/GiftClaimActorProvider"
import { useGiftMakerHistory } from "../../stores/giftMakerHistory"
import type { GiftLinkData } from "../../types/sharedTypes"
import { type GiftInfo, parseGiftInfos } from "../../utils/parseGiftInfos"
import { GiftHistoryEmpty } from "./GiftHistoryEmpty"
import { GiftHistorySkeleton } from "./GiftHistorySkeleton"
import { GiftMakerHistoryItem } from "./GiftMakerHistoryItem"

export type GiftHistoryProps = {
  signerCredentials: SignerCredentials
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
  generateLink: (giftLinkData: GiftLinkData) => string
}

const ITEMS_TO_SHOW = 4

export function GiftHistory({
  signerCredentials,
  tokenList,
  generateLink,
}: GiftHistoryProps) {
  const [loading, setLoading] = useState(true)
  const gifts = useGiftMakerHistory((s) => {
    const userId = userAddressToDefuseUserId(
      signerCredentials.credential,
      signerCredentials.credentialType
    )
    return s.gifts[userId]
  })

  const [giftInfos, setGiftInfos] = useState<GiftInfo[] | null>(null)
  const [itemsToShow, setItemsToShow] = useState(ITEMS_TO_SHOW)

  const handleShowMore = () => {
    setItemsToShow((prev) => prev + ITEMS_TO_SHOW)
  }

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

  const visibleGiftItems = useMemo(
    () => giftInfos?.slice(0, itemsToShow),
    [giftInfos, itemsToShow]
  )

  if (gifts === undefined) {
    return null
  }

  if (loading) {
    return (
      <div className="widget-container flex flex-col gap-4 p-5">
        <HistoryHeader />
        <GiftHistorySkeleton />
      </div>
    )
  }

  return (
    <div className="widget-container flex flex-col gap-4 p-5">
      <HistoryHeader />
      <GiftClaimActorProvider signerCredentials={signerCredentials}>
        {visibleGiftItems?.map((giftInfo) => (
          <GiftMakerHistoryItem
            key={crypto.randomUUID()}
            giftInfo={giftInfo}
            generateLink={generateLink}
            signerCredentials={signerCredentials}
          />
        ))}
        {giftInfos?.length === 0 && <GiftHistoryEmpty />}
        {giftInfos && itemsToShow < giftInfos.length && (
          <ButtonCustom
            type="submit"
            size="sm"
            variant="secondary"
            onClick={handleShowMore}
          >
            Show more
          </ButtonCustom>
        )}
      </GiftClaimActorProvider>
    </div>
  )
}

const HistoryHeader = () => {
  return <div className="text-sm font-bold text-black">Your gifts</div>
}
