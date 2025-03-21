import { useMemo } from "react"
import { useEffect, useState } from "react"
import { SwapWidgetProvider } from "src/providers/SwapWidgetProvider"
import type { BaseTokenInfo, UnifiedTokenInfo } from "src/types/base"
import type { ChainType } from "src/types/deposit"
import { WidgetRoot } from "../../../components/WidgetRoot"
import type { SignerCredentials } from "../../../core/formatters"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import { GiftClaimActorProvider } from "../providers/GiftClaimActorProvider"
import { TabProvider, useTabContext } from "../providers/TabProvider"
import { useGiftMakerHistory } from "../stores/giftMakerHistory"
import type { GiftPayload } from "../types/sharedTypes"
import { type GiftInfos, parseGiftInfos } from "../utils/parseGiftInfos"
import { GiftHistoryEmpty } from "./shared/GiftHistoryEmpty"
import { GiftHistorySkeleton } from "./shared/GiftHistorySkeleton"
import { GiftHistoryTabs } from "./shared/GiftHistoryTabs"
import { GiftMakerHistoryItem } from "./shared/GiftMakerHistoryItem"

export type GiftHistoryWidgetProps = {
  userAddress: string | null | undefined
  userChainType: ChainType | null | undefined
  generateLink: (giftPayload: GiftPayload) => string
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
}

export function GiftHistoryWidget({
  generateLink,
  userAddress,
  userChainType,
  tokenList,
}: GiftHistoryWidgetProps) {
  const signerCredentials: SignerCredentials | null = useMemo(() => {
    return userAddress && userChainType
      ? {
          credential: userAddress,
          credentialType: userChainType,
        }
      : null
  }, [userChainType, userAddress])

  return (
    <WidgetRoot>
      <SwapWidgetProvider>
        <TabProvider>
          {signerCredentials && (
            <GiftHistory
              signerCredentials={signerCredentials}
              tokenList={tokenList}
              generateLink={generateLink}
            />
          )}
        </TabProvider>
      </SwapWidgetProvider>
    </WidgetRoot>
  )
}

type GiftHistoryProps = {
  signerCredentials: SignerCredentials
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
  generateLink: (giftPayload: GiftPayload) => string
}

function GiftHistory({
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
    return <GiftHistorySkeleton />
  }

  return (
    <div className="widget-container flex flex-col gap-4 p-5">
      <GiftHistoryTabs />
      <GiftClaimActorProvider signerCredentials={signerCredentials}>
        {activeTab === "pending" &&
          giftInfos?.pending.map((giftInfo) => (
            <GiftMakerHistoryItem
              tag={activeTab}
              key={giftInfo.giftId}
              giftInfo={giftInfo}
              generateLink={generateLink}
              signerCredentials={signerCredentials}
            />
          ))}
        {activeTab === "history" &&
          giftInfos?.claimed.map((giftInfo) => (
            <GiftMakerHistoryItem
              tag={activeTab}
              key={giftInfo.giftId}
              giftInfo={giftInfo}
              generateLink={generateLink}
              signerCredentials={signerCredentials}
            />
          ))}
        {giftInfos?.pending.length === 0 ||
          (giftInfos?.claimed.length === 0 && (
            <GiftHistoryEmpty tag={activeTab} />
          ))}
      </GiftClaimActorProvider>
    </div>
  )
}
