import { useActorRef, useSelector } from "@xstate/react"
import { WidgetRoot } from "../../../components/WidgetRoot"
import type { SignerCredentials } from "../../../core/formatters"
import { SwapWidgetProvider } from "../../../providers/SwapWidgetProvider"
import type { AuthMethod } from "../../../types/authHandle"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import { giftTakerRootMachine } from "../actors/giftTakerRootMachine"
import { GiftTakerForm } from "./GiftTakerForm"
import { GiftTakerInvalidClaim } from "./GiftTakerInvalidClaim"
import { GiftTakerSuccessScreen } from "./GiftTakerSuccessScreen"

export type GiftTakerWidgetProps = {
  secretKey: string

  /** List of available tokens for trading */
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]

  /** User's wallet address */
  userAddress: string | null | undefined
  userChainType: AuthMethod | null | undefined

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

  const giftTakerRootRef = useActorRef(giftTakerRootMachine, {
    input: {
      secretKey,
      tokenList,
    },
  })

  const signerCredentials: SignerCredentials | null =
    userAddress != null && userChainType != null
      ? { credential: userAddress, credentialType: userChainType }
      : null

  const snapshot = useSelector(giftTakerRootRef, (state) => state)
  const intentHashes = snapshot.context.intentHashes
  const giftInfo = snapshot.context.giftInfo

  if (snapshot?.context.error != null) {
    return <GiftTakerInvalidClaim error={snapshot.context.error.reason} />
  }

  if (giftInfo == null) {
    return loading
  }

  return (
    <>
      {intentHashes ? (
        <GiftTakerSuccessScreen
          giftInfo={giftInfo}
          intentHashes={intentHashes}
        />
      ) : (
        <GiftTakerForm
          giftInfo={giftInfo}
          signerCredentials={signerCredentials}
          giftTakerRootRef={giftTakerRootRef}
          intentHashes={intentHashes}
        />
      )}
    </>
  )
}
