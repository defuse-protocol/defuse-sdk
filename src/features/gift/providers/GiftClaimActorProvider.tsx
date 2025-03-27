import { Err, Ok, type Result } from "@thames/monads"
import { type ReactNode, createContext, useEffect, useState } from "react"
import type { SignerCredentials } from "src/core/formatters"
import { userAddressToDefuseUserId } from "src/utils/defuse"
import { type ActorRefFrom, createActor, toPromise } from "xstate"
import { logger } from "../../../logger"
import type { GiftInfo } from "../actors/shared/getGiftInfo"
import {
  type GiftClaimActorOutput,
  giftClaimActor,
} from "../actors/shared/giftClaimActor"
import { CancellationDialog } from "../components/GiftMakerReadyDialog"
import { giftMakerHistoryStore } from "../stores/giftMakerHistory"

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

    return toPromise(actor)
      .then(Ok)
      .finally(async () => {
        if (giftInfo.giftId) {
          const result = await giftMakerHistoryStore
            .getState()
            .removeGift(giftInfo.giftId, signerCredentials)
          if (result.tag === "err") {
            logger.error(
              new Error("Failed to remove gift", { cause: result.reason })
            )
          }
        }
        clearActorRef()
      })
  }

  return (
    <GiftClaimActorContext.Provider value={{ cancelGift }}>
      {children}

      {giftInfo != null && (
        <CancellationDialog
          giftInfo={giftInfo}
          actorRef={actorRef}
          signerCredentials={{
            credential: userAddressToDefuseUserId(
              signerCredentials.credential,
              signerCredentials.credentialType
            ),
            credentialType: signerCredentials.credentialType,
          }}
        />
      )}
    </GiftClaimActorContext.Provider>
  )
}
