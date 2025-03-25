import { useEffect, useRef } from "react"
import type { ActorRefFrom } from "xstate"
import type { SignerCredentials } from "../../../core/formatters"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import type { giftMakerRootMachine } from "../actors/giftMakerRootMachine"
import { useGiftMakerHistory } from "../stores/giftMakerHistory"

export function useBalanceUpdaterSyncWithHistory(
  rootActorRef: ActorRefFrom<typeof giftMakerRootMachine>,
  signerCredentials: SignerCredentials | null
) {
  const gifts = useGiftMakerHistory((s) => {
    if (signerCredentials == null) {
      return []
    }
    const userId = userAddressToDefuseUserId(
      signerCredentials.credential,
      signerCredentials.credentialType
    )
    return s.gifts[userId]
  })

  const prevGiftsLengthRef = useRef<number | null>(null)

  useEffect(() => {
    const currentLength = gifts?.length ?? 0
    if (
      prevGiftsLengthRef.current !== null &&
      currentLength < prevGiftsLengthRef.current
    ) {
      rootActorRef.send({ type: "REQUEST_BALANCE_REFRESH" })
    }
    prevGiftsLengthRef.current = currentLength
  }, [gifts, rootActorRef])
}
