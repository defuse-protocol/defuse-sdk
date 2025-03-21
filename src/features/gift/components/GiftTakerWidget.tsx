import { useActorRef, useSelector } from "@xstate/react"
import { userAddressToDefuseUserId } from "src/utils/defuse"
import { WidgetRoot } from "../../../components/WidgetRoot"
import type { SignerCredentials } from "../../../core/formatters"
import { SwapWidgetProvider } from "../../../providers/SwapWidgetProvider"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { ChainType } from "../../../types/deposit"
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

  const giftTakerRootRef = useActorRef(giftTakerRootMachine, {
    input: {
      secretKey,
      tokenList,
    },
  })

  const signerCredentials: SignerCredentials | null =
    userAddress != null && userChainType != null
      ? {
          credential: userAddressToDefuseUserId(userAddress, userChainType),
          credentialType: userChainType,
        }
      : null

  const snapshot = useSelector(giftTakerRootRef, (state) => state)

  if (snapshot?.context.error != null) {
    return <GiftTakerInvalidClaim error={snapshot.context.error.reason} />
  }

  if (snapshot.context.giftInfo == null) {
    return loading
  }

  return (
    <>
      {snapshot.context.intentHashes ? (
        <GiftTakerSuccessScreen
          giftInfo={snapshot.context.giftInfo}
          intentHashes={snapshot.context.intentHashes}
        />
      ) : (
        <GiftTakerForm
          giftInfo={snapshot.context.giftInfo}
          signerCredentials={signerCredentials}
          giftTakerRootRef={giftTakerRootRef}
        />
      )}
    </>
  )
}
