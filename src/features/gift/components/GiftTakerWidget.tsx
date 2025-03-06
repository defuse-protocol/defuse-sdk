import type { Result } from "@thames/monads"
import { useEffect, useState } from "react"
import { logger } from "src/logger"
import { WidgetRoot } from "../../../components/WidgetRoot"
import type { SignerCredentials } from "../../../core/formatters"
import { SwapWidgetProvider } from "../../../providers/SwapWidgetProvider"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { ChainType } from "../../../types/deposit"
import { deriveGiftTerms } from "../utils/deriveGiftTerms"
import type { GiftTerms } from "../utils/deriveGiftTerms"
import { GiftTakerForm } from "./GiftTakerForm"
import { GiftTakerSuccessScreen } from "./GiftTakerSuccessScreen"

export type GiftTakerWidgetProps = {
  secretKey: string

  /** List of available tokens for trading */
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]

  /** User's wallet address */
  userAddress: string | null | undefined
  userChainType: ChainType | null | undefined

  /** Theme selection */
  theme?: "dark" | "light"
}

export function GiftTakerWidget(props: GiftTakerWidgetProps) {
  return (
    <WidgetRoot>
      <SwapWidgetProvider>
        <div className="widget-container rounded-2xl bg-gray-1 p-5 shadow">
          <GiftTakerScreens {...props} />
        </div>
      </SwapWidgetProvider>
    </WidgetRoot>
  )
}

function GiftTakerScreens({
  secretKey,
  tokenList,
  userAddress,
  userChainType,
}: GiftTakerWidgetProps) {
  const loading = <div>Loading...</div>

  const signerCredentials: SignerCredentials | null =
    userAddress != null && userChainType != null
      ? { credential: userAddress, credentialType: userChainType }
      : null

  const [giftTerms, setGiftTerms] = useState<Result<GiftTerms, string> | null>(
    null
  )

  const [claimResult, setClaimResult] = useState<{
    intentHashes: string[]
  } | null>(null)

  useEffect(() => {
    deriveGiftTerms(secretKey, tokenList).then((result) => {
      if (result.isErr()) {
        logger.error(result.unwrapErr())
      }
      setGiftTerms(result)
    })
  }, [secretKey, tokenList])

  if (giftTerms == null) {
    return loading
  }

  return giftTerms.match({
    ok: (giftTerms) =>
      claimResult !== null ? (
        <GiftTakerSuccessScreen
          giftTerms={giftTerms}
          intentHashes={claimResult.intentHashes}
        />
      ) : (
        <GiftTakerForm
          giftTerms={giftTerms}
          signerCredentials={signerCredentials}
          onSuccessClaim={setClaimResult}
        />
      ),
    err: (error) => <div>Error: {error}</div>,
  })
}
