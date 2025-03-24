import { useEffect } from "react"
import type { ActorRefFrom } from "xstate"
import type { ChainType } from "../../../types/deposit"
import type { giftMakerRootMachine } from "../actors/giftMakerRootMachine"

export function useCheckSignerCredentials(
  rootActorRef: ActorRefFrom<typeof giftMakerRootMachine>,
  signerCredentials: { credential: string; credentialType: ChainType } | null
) {
  useEffect(() => {
    if (signerCredentials == null) {
      rootActorRef.send({ type: "LOGOUT" })
    } else {
      rootActorRef.send({
        type: "LOGIN",
        params: {
          userAddress: signerCredentials.credential,
          userChainType: signerCredentials.credentialType,
        },
      })
    }
  }, [rootActorRef, signerCredentials])
}
