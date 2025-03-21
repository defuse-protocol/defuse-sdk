import { useEffect, useState } from "react"
import type { SignerCredentials } from "src/core/formatters"
import type { BaseTokenInfo, UnifiedTokenInfo } from "src/types/base"
import { userAddressToDefuseUserId } from "../../../../utils/defuse"
import { GiftClaimActorProvider } from "../../providers/GiftClaimActorProvider"
import { useTabContext } from "../../providers/TabProvider"
import { useGiftMakerHistory } from "../../stores/giftMakerHistory"
import type { GiftLinkData } from "../../types/sharedTypes"
import { type GiftInfos, parseGiftInfos } from "../../utils/parseGiftInfos"
import { GiftHistoryEmpty } from "./GiftHistoryEmpty"
import { GiftHistorySkeleton } from "./GiftHistorySkeleton"
import { GiftHistoryTabs } from "./GiftHistoryTabs"
import { GiftMakerHistoryCollapsibleInfo } from "./GiftMakerHistoryCollapsibleInfo"
import { GiftMakerHistoryItem } from "./GiftMakerHistoryItem"

export type GiftHistoryProps = {
  signerCredentials: SignerCredentials
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
  generateLink: (giftLinkData: GiftLinkData) => string
}

export function GiftHistory({
  signerCredentials,
  tokenList,
  generateLink,
}: GiftHistoryProps) {
  const { activeTab } = useTabContext()
  const [loading, setLoading] = useState(true)
  const gifts = useGiftMakerHistory((s) => {
    const userId = userAddressToDefuseUserId(
      signerCredentials.credential,
      signerCredentials.credentialType
    )
    return s.gifts[userId]
  })

  const [giftInfos, setGiftInfos] = useState<GiftInfos | null>(null)
  useEffect(() => {
    if (gifts === undefined) {
      return
    }
    parseGiftInfos(tokenList, gifts).then((giftsResult) => {
      setGiftInfos(giftsResult.unwrap())
      setLoading(false)
    })
  }, [gifts, tokenList])

  if (gifts === undefined) {
    return null
  }

  if (loading) {
    return (
      <div className="widget-container flex flex-col gap-4 p-5">
        <GiftHistoryTabs />
        <GiftHistorySkeleton />
      </div>
    )
  }

  const giftItemsBoundToTab =
    activeTab === "pending" ? giftInfos?.pending : giftInfos?.claimed

  return (
    <div className="widget-container flex flex-col gap-4 p-5">
      <GiftHistoryTabs />
      <GiftClaimActorProvider signerCredentials={signerCredentials}>
        {giftItemsBoundToTab?.map((giftInfo) => (
          <GiftMakerHistoryCollapsibleInfo
            key={giftInfo.giftId}
            giftInfo={giftInfo}
          >
            <GiftMakerHistoryItem
              itemType={activeTab}
              giftInfo={giftInfo}
              generateLink={generateLink}
              signerCredentials={signerCredentials}
            />
          </GiftMakerHistoryCollapsibleInfo>
        ))}
        {giftItemsBoundToTab?.length === 0 && (
          <GiftHistoryEmpty tag={activeTab} />
        )}
      </GiftClaimActorProvider>
    </div>
  )
}
