import { Err, Ok, type Result } from "@thames/monads"
import { type ReactNode, createContext, useEffect, useState } from "react"
import type { SignerCredentials } from "src/core/formatters"
import { type ActorRefFrom, createActor, toPromise } from "xstate"
import type { GiftInfo } from "../actors/shared/getGiftInfo"
import {
  type GiftClaimActorOutput,
  giftClaimActor,
} from "../actors/shared/giftClaimActor"
import { CancellationDialog } from "../components/GiftMakerReadyDialog"

export const GiftClaimActorContext = createContext<{
  cancelGift: (args: {
    giftInfo: GiftInfo
    signerCredentials: SignerCredentials
  }) => Promise<
    Result<GiftClaimActorOutput, { reason: "CANCELLATION_IN_PROGRESS" }>
  >
}>({
  cancelGift: async () => {
    throw new Error("not implemented")
  },
})

export function GiftClaimActorProvider({
  children,
  signerCredentials,
}: {
  children: ReactNode
  signerCredentials: SignerCredentials
}) {
  const [giftInfo, setGiftInfo] = useState<GiftInfo | null>(null)
  const [actorRef, setActorRef] = useState<ActorRefFrom<
    typeof giftClaimActor
  > | null>(null)

  useEffect(() => {
    return () => {
      if (actorRef) {
        actorRef.stop()
      }
    }
  }, [actorRef])

  const clearActorRef = () => {
    setActorRef(null)
  }

  const cancelGift = async ({
    giftInfo,
    signerCredentials,
  }: {
    giftInfo: GiftInfo
    signerCredentials: SignerCredentials
  }): Promise<
    Result<GiftClaimActorOutput, { reason: "CANCELLATION_IN_PROGRESS" }>
  > => {
    if (actorRef) {
      return Err({
        reason: "CANCELLATION_IN_PROGRESS",
      })
    }

    setGiftInfo(giftInfo)

    const actor = createActor(giftClaimActor, {
      input: {
        giftInfo: giftInfo,
        signerCredentials: signerCredentials,
      },
    })

    setActorRef(actor)

    actor.start()

    return toPromise(actor).then(Ok).finally(clearActorRef)
  }

  return (
    <GiftClaimActorContext.Provider value={{ cancelGift }}>
      {children}

      {giftInfo != null && (
        <CancellationDialog
          giftInfo={giftInfo}
          actorRef={actorRef}
          signerCredentials={signerCredentials}
        />
      )}
    </GiftClaimActorContext.Provider>
  )
}
