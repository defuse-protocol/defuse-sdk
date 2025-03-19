import { useMemo } from "react"
import { useEffect, useState } from "react"
import { SwapWidgetProvider } from "src/providers/SwapWidgetProvider"
import type {} from "src/types/base"
import type { BaseTokenInfo, UnifiedTokenInfo } from "src/types/base"
import type { ChainType } from "src/types/deposit"
import { WidgetRoot } from "../../../components/WidgetRoot"
import type { SignerCredentials } from "../../../core/formatters"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import {
  TabProvider,
  useHistoryTab,
  usePendingTab,
} from "../context/TabContext"
import { useGiftMakerHistory } from "../stores/giftMakerHistory"
import type { GiftPayload } from "../types/sharedTypes"
import { type GiftInfos, parseGiftInfos } from "../utils/parseGiftInfos"
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
    return userAddress != null && userChainType != null
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
          {signerCredentials != null && (
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
  const pendingTab = usePendingTab()
  const historyTab = useHistoryTab()

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
    if (gifts == null) {
      return
    }
    parseGiftInfos(tokenList, gifts).then((giftsResult) => {
      setGiftInfos(giftsResult.unwrap())
      setLoading(false)
    })
  }, [gifts, tokenList])

  if (loading) {
    return <GiftHistorySkeleton />
  }

  if (gifts == null || gifts.length === 0) {
    return <div className="flex flex-col gap-2.5">No pending gifts found</div>
  }

  return (
    <div className="widget-container flex flex-col gap-4 p-5">
      <GiftHistoryTabs />
      {pendingTab &&
        giftInfos?.pending.map((giftInfo) => (
          <GiftMakerHistoryItem
            tag="pending"
            key={giftInfo.giftId}
            giftInfo={giftInfo}
            generateLink={generateLink}
          />
        ))}
      {historyTab &&
        giftInfos?.claimed.map((giftInfo) => (
          <GiftMakerHistoryItem
            tag="history"
            key={giftInfo.giftId}
            giftInfo={giftInfo}
            generateLink={generateLink}
          />
        ))}
    </div>
  )
}
