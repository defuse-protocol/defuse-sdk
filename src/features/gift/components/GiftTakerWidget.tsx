import { useQuery } from "@tanstack/react-query"
import { useActorRef, useSelector } from "@xstate/react"
import { waitForIntentSettlement } from "src/services/intentService"
import { assert } from "src/utils/assert"
import { WidgetRoot } from "../../../components/WidgetRoot"
import type { SignerCredentials } from "../../../core/formatters"
import { SwapWidgetProvider } from "../../../providers/SwapWidgetProvider"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { ChainType } from "../../../types/deposit"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import {} from "../../../utils/tokenUtils"
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
  const intentHashes = snapshot.context.intentHashes
  const giftInfo = snapshot.context.giftInfo

  const intentStatus = useQuery({
    queryKey: ["intents_status", intentHashes],
    queryFn: async ({ signal }) => {
      assert(intentHashes != null)
      const intentHash = intentHashes[0]
      assert(intentHash != null)
      return waitForIntentSettlement(signal, intentHash)
    },
    enabled: intentHashes != null,
  })

  if (snapshot?.context.error != null) {
    return <GiftTakerInvalidClaim error={snapshot.context.error.reason} />
  }

  if (giftInfo == null) {
    return loading
  }

  return (
    <>
      {intentHashes && intentStatus.data ? (
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
