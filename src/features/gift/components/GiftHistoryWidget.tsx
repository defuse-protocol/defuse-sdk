import { useMemo } from "react"
import { WidgetRoot } from "../../../components/WidgetRoot"
import type { SignerCredentials } from "../../../core/formatters"
import { SwapWidgetProvider } from "../../../providers/SwapWidgetProvider"
import type { AuthMethod } from "../../../types/authHandle"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { GiftLinkData } from "../types/sharedTypes"
import { GiftHistory } from "./shared/GiftHistory"

export type GiftHistoryWidgetProps = {
  userAddress: string | null | undefined
  userChainType: AuthMethod | null | undefined
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
        {signerCredentials && (
          <GiftHistory
            signerCredentials={signerCredentials}
            tokenList={tokenList}
            generateLink={generateLink}
          />
        )}
      </SwapWidgetProvider>
    </WidgetRoot>
  )
}
