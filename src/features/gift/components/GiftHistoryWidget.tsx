import { useMemo } from "react"
import { SwapWidgetProvider } from "src/providers/SwapWidgetProvider"
import type { BaseTokenInfo, UnifiedTokenInfo } from "src/types/base"
import type { ChainType } from "src/types/deposit"
import { WidgetRoot } from "../../../components/WidgetRoot"
import type { SignerCredentials } from "../../../core/formatters"
import { TabProvider } from "../providers/TabProvider"
import type { GiftLinkData } from "../types/sharedTypes"
import { GiftHistory } from "./shared/GiftHistory"

export type GiftHistoryWidgetProps = {
  userAddress: string | null | undefined
  userChainType: ChainType | null | undefined
  generateLink: (giftLinkData: GiftLinkData) => string
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
