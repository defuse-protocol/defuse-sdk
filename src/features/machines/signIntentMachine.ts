import { secp256k1 } from "@noble/curves/secp256k1"
import { base58 } from "@scure/base"
import { sign } from "tweetnacl"
import { verifyMessage as verifyMessageViem } from "viem"
import { assertEvent, assign, fromPromise, setup } from "xstate"
import {
  type SignerCredentials,
  formatSignedIntent,
} from "../../core/formatters"
import { logger } from "../../logger"
import type { MultiPayload } from "../../types/defuse-contracts-types"
import type { WalletMessage, WalletSignatureResult } from "../../types/swap"
import { assert } from "../../utils/assert"
import {
  type WalletErrorCode,
  extractWalletErrorCode,
} from "../../utils/walletErrorExtractor"
import {
  parsePublicKey,
  verifyAuthenticatorAssertion,
} from "../../utils/webAuthn"
import type { SignMessage } from "../otcDesk/types/sharedTypes"

// No-op usage to prevent tree-shaking. sec256k1 is dynamically loaded by viem.
const _noop = secp256k1.getPublicKey || null

export type Errors = {
  reason:
    | "ERR_USER_DIDNT_SIGN"
    | "ERR_CANNOT_VERIFY_SIGNATURE"
    | "ERR_SIGNED_DIFFERENT_ACCOUNT"
    | WalletErrorCode
  error: Error | null
}

export type Success = {
  multiPayload: MultiPayload
  signatureResult: WalletSignatureResult
  signerCredentials: SignerCredentials
}

type Context = {
  signerCredentials: SignerCredentials
  signature: WalletSignatureResult | null
  error: null | Errors
}

export type Input = {
  signerCredentials: SignerCredentials
  signMessage: SignMessage
  walletMessage: WalletMessage
}

export type Output =
  | { tag: "err"; value: Errors }
  | { tag: "ok"; value: Success }

export const signIntentMachine = setup({
  types: {
    context: {} as Context,
    input: {} as Input,
    output: {} as Output,
  },
  actions: {
    setError: assign({
      error: (_, error: Errors) => error,
    }),
    logError: (_, params: { error: unknown }) => {
      logger.error(params.error)
    },
    setSignature: assign({
      signature: (_, signature: WalletSignatureResult | null) => signature,
    }),
  },
  actors: {
    verifySignatureActor: fromPromise(
      ({
        input,
      }: {
        input: {
          signature: WalletSignatureResult
          signerCredentials: SignerCredentials
        }
      }) =>
        verifyWalletSignature(
          input.signature,
          input.signerCredentials.credential
        )
    ),
    task: fromPromise(
      async ({
        input,
      }: { input: () => Promise<unknown> }): Promise<unknown> => {
        return input()
      }
    ),
  },
  guards: {
    isTrue: (_, params: boolean) => params,
  },
}).createMachine({
  context: ({ input }) => {
    return {
      signerCredentials: input.signerCredentials,
      signature: null,
      error: null,
    }
  },

  initial: "Signing",

  output: ({ context }): Output => {
    if (context.error != null) {
      return { tag: "err", value: context.error }
    }

    assert(context.signature != null, "Signature is not set")

    return {
      tag: "ok",
      value: {
        multiPayload: formatSignedIntent(
          context.signature,
          context.signerCredentials
        ),
        signatureResult: context.signature,
        signerCredentials: context.signerCredentials,
      },
    }
  },

  states: {
    Signing: {
      invoke: {
        src: "task",

        input: ({ event }) => {
          assertEvent(event, "xstate.init")
          const input = event.input as Input
          return () => {
            return input.signMessage(input.walletMessage)
          }
        },

        onDone: {
          target: "Verifying Signature",

          actions: {
            type: "setSignature",
            params: ({ event }) =>
              event.output as Awaited<ReturnType<SignMessage>>,
          },
        },

        onError: {
          target: "Generic Error",
          description: "USER_DIDNT_SIGN",

          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => {
                return {
                  reason: extractWalletErrorCode(
                    event.error,
                    "ERR_USER_DIDNT_SIGN"
                  ),
                  error: toError(event.error),
                }
              },
            },
          ],
        },
      },
    },

    "Verifying Signature": {
      invoke: {
        src: "verifySignatureActor",
        input: ({ context }) => {
          assert(context.signature != null, "Signature is not set")
          return {
            signature: context.signature,
            signerCredentials: context.signerCredentials,
          }
        },
        onDone: [
          {
            target: "Completed",
            guard: {
              type: "isTrue",
              params: ({ event }) => event.output,
            },
          },
          {
            target: "Generic Error",
            description: "SIGNED_DIFFERENT_ACCOUNT",
            actions: {
              type: "setError",
              params: {
                reason: "ERR_SIGNED_DIFFERENT_ACCOUNT",
                error: null,
              },
            },
          },
        ],

        onError: {
          target: "Generic Error",
          description: "ERR_CANNOT_VERIFY_SIGNATURE",

          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => ({
                reason: "ERR_CANNOT_VERIFY_SIGNATURE",
                error: toError(event.error),
              }),
            },
          ],
        },
      },
    },

    Completed: {
      type: "final",
    },

    "Generic Error": {
      type: "final",
    },
  },
})

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("unknown error")
}

async function verifyWalletSignature(
  signature: WalletSignatureResult,
  userAddress: string
) {
  if (signature == null) return false

  const signatureType = signature.type
  switch (signatureType) {
    case "NEP413":
      return (
        // For NEP-413, it's enough to ensure user didn't switch the account
        signature.signatureData.accountId === userAddress
      )
    case "ERC191": {
      return verifyMessageViem({
        address: userAddress as "0x${string}",
        message: signature.signedData.message,
        signature: signature.signatureData as "0x${string}",
      })
    }
    case "SOLANA": {
      return sign.detached.verify(
        signature.signedData.message,
        signature.signatureData,
        base58.decode(userAddress)
      )
    }
    case "WEBAUTHN":
      return verifyAuthenticatorAssertion(
        signature.signatureData,
        parsePublicKey(userAddress),
        signature.signedData.challenge
      )
    default:
      signatureType satisfies never
      throw new Error("exhaustive check failed")
  }
}
