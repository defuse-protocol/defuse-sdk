import { createActor, toPromise } from "xstate"
import type { SignerCredentials } from "../../../core/formatters"
import type { WalletMessage } from "../../../types/swap"
import {
  type Errors,
  type Success,
  signIntentMachine,
} from "../../machines/signIntentMachine"
import type { SignMessage } from "../types/sharedTypes"
import { toResult } from "./monadsUtils"

export type { Errors as SignIntentErr, Success as SignIntentOk }

export function signIntent({
  signerCredentials,
  signMessage,
  walletMessage,
}: {
  signerCredentials: SignerCredentials
  signMessage: SignMessage
  walletMessage: WalletMessage
}) {
  const signIntentActor = createActor(signIntentMachine, {
    input: {
      signerCredentials,
      signMessage,
      walletMessage,
    },
  })

  signIntentActor.start()

  return toPromise(signIntentActor).then(toResult)
}
