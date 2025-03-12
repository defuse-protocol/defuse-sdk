import type { Result } from "@thames/monads"
import { useActorRef, useSelector } from "@xstate/react"
import { useEffect, useState } from "react"
import { logger } from "src/logger"
import type {} from "xstate"
import { WidgetRoot } from "../../../components/WidgetRoot"
import type { SignerCredentials } from "../../../core/formatters"
import { SwapWidgetProvider } from "../../../providers/SwapWidgetProvider"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { ChainType } from "../../../types/deposit"
import { giftTakerRootMachine } from "../actors/giftTakerRootMachine"
import { type GiftInfo, getGiftInfo } from "../utils/getGiftInfo"
import { GiftTakerForm } from "./GiftTakerForm"
import { GiftTakerInvalidClaim } from "./GiftTakerInvalidClaim"
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

  const giftTakerClaimRef = useActorRef(giftTakerRootMachine)

  const signerCredentials: SignerCredentials | null =
    userAddress != null && userChainType != null
      ? { credential: userAddress, credentialType: userChainType }
      : null

  const [giftInfo, setGiftInfo] = useState<Result<GiftInfo, string> | null>(
    null
  )
  const snapshot = useSelector(giftTakerClaimRef, (state) => state)

  useEffect(() => {
    getGiftInfo(secretKey, tokenList).then((result) => {
      if (result.isErr()) {
        logger.error(result.unwrapErr())
      }
      setGiftInfo(result)
    })
  }, [secretKey, tokenList])

  if (giftInfo == null) {
    return loading
  }

  return giftInfo.match({
    ok: (giftInfo) =>
      snapshot.status === "done" && snapshot.context.intentHashes ? (
        <GiftTakerSuccessScreen
          giftInfo={giftInfo}
          intentHashes={snapshot.context.intentHashes}
        />
      ) : (
        <GiftTakerForm
          giftInfo={giftInfo}
          signerCredentials={signerCredentials}
          giftTakerClaimRef={giftTakerClaimRef}
        />
      ),
    err: (error) => <GiftTakerInvalidClaim error={error} />,
  })
}
