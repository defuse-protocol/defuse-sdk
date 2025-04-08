import { useActorRef, useSelector } from "@xstate/react"
import type { ActorRefFrom } from "xstate"
import { WidgetRoot } from "../../../components/WidgetRoot"
import type { SignerCredentials } from "../../../core/formatters"
import { SwapWidgetProvider } from "../../../providers/SwapWidgetProvider"
import type { AuthMethod } from "../../../types/authHandle"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { RenderHostAppLink } from "../../../types/hostAppLink"
import { giftTakerRootMachine } from "../actors/giftTakerRootMachine"
import type { giftClaimActor } from "../actors/shared/giftClaimActor"
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

  renderHostAppLink: RenderHostAppLink
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
  renderHostAppLink,
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

  const { snapshot, giftTakerClaimRef } = useSelector(
    giftTakerRootRef,
    (state) => ({
      giftTakerClaimRef: state.children.giftTakerClaimRef as
        | undefined
        | ActorRefFrom<typeof giftClaimActor>,
      snapshot: state,
    })
  )
  const intentHashes = snapshot.context.intentHashes
  const giftInfo = snapshot.context.giftInfo

  const claimSnapshot = useSelector(giftTakerClaimRef, (state) => state)
  const error = claimSnapshot?.context.error ?? snapshot.context.error

  if (error != null) {
    return <GiftTakerInvalidClaim error={error.reason} />
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
          renderHostAppLink={renderHostAppLink}
        />
      )}
    </>
  )
}
