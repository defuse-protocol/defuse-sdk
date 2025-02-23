import { providers } from "near-api-js"
import { assign, fromPromise, setup } from "xstate"
import type { SignerCredentials } from "../../core/formatters"
import { logger } from "../../logger"
import { publishIntent } from "../../services/intentService"
import type { MultiPayload } from "../../types/defuse-contracts-types"
import type { WalletSignatureResult } from "../../types/swap"
import { assert } from "../../utils/assert"
import type { WalletErrorCode } from "../../utils/walletErrorExtractor"
import {
  type ErrorCodes as PublicKeyVerifierErrorCodes,
  publicKeyVerifierMachine,
} from "./publicKeyVerifierMachine"

type Context = {
  signerCredentials: SignerCredentials
  signature: WalletSignatureResult
  multiPayload: MultiPayload
  quoteHashes?: string[]
  intentHash: string | null
  error: null | Errors
}

export type Errors =
  | {
      reason:
        | "ERR_USER_DIDNT_SIGN"
        | "ERR_CANNOT_VERIFY_SIGNATURE"
        | "ERR_SIGNED_DIFFERENT_ACCOUNT"
        | "ERR_PUBKEY_EXCEPTION"
        | "ERR_CANNOT_PUBLISH_INTENT"
        | "ERR_QUOTE_EXPIRED_RETURN_IS_LOWER"
        | "ERR_NONCE_USED"
        | WalletErrorCode
        | PublicKeyVerifierErrorCodes
      error: Error | null
    }
  | {
      reason: "ERR_CANNOT_PUBLISH_INTENT"
      server_reason: string
    }

export type Input = {
  signerCredentials: SignerCredentials
  signature: WalletSignatureResult
  multiPayload: MultiPayload
  quoteHashes?: string[]
}

export type Output =
  | { tag: "err"; value: Errors }
  | { tag: "ok"; value: { intentHash: string } }

export const publishIntentMachine = setup({
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
    setIntentHash: assign({
      intentHash: (_, intentHash: string) => intentHash,
    }),
  },
  actors: {
    publicKeyVerifierActor: publicKeyVerifierMachine,
    broadcastMessage: fromPromise(
      async ({
        input,
      }: {
        input: {
          signatureData: WalletSignatureResult
          signerCredentials: SignerCredentials
          quoteHashes?: string[]
        }
      }) =>
        publishIntent(
          input.signatureData,
          {
            userAddress: input.signerCredentials.credential,
            userChainType: input.signerCredentials.credentialType,
          },
          input.quoteHashes ?? []
        )
    ),
  },
  guards: {
    isOk: (_, params: { tag: "ok" } | { tag: "err" }) => params.tag === "ok",
  },
}).createMachine({
  context: ({ input }) => ({
    ...input,
    intentHash: null,
    error: null,
  }),

  output: ({ context }): Output => {
    if (context.error != null) {
      return { tag: "err", value: context.error }
    }

    if (context.intentHash == null) {
      throw new Error("Unexpected output, intent hash must be set")
    }

    return { tag: "ok", value: { intentHash: context.intentHash } }
  },

  initial: "Verifying Public Key Presence",

  states: {
    "Verifying Public Key Presence": {
      invoke: {
        id: "publicKeyVerifierRef",
        src: "publicKeyVerifierActor",
        input: ({ context }) => {
          return {
            nearAccount:
              context.signature.type === "NEP413"
                ? context.signature.signatureData
                : null,
            nearClient: new providers.JsonRpcProvider({
              url: "https://nearrpc.aurora.dev",
            }),
          }
        },

        onError: {
          target: "Generic Error",
          description: "ERR_PUBKEY_EXCEPTION",

          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => ({
                reason: "ERR_PUBKEY_EXCEPTION",
                error: toError(event.error),
              }),
            },
          ],
        },

        onDone: [
          {
            target: "Broadcasting Intent",
            guard: {
              type: "isOk",
              params: ({ event }) => event.output,
            },
          },
          {
            target: "Generic Error",
            description: "ERR_PUBKEY_*",

            actions: {
              type: "setError",
              params: ({ event }) => {
                assert(event.output.tag === "err")
                return {
                  reason: event.output.value,
                  error: null,
                }
              },
            },
          },
        ],
      },
    },

    "Broadcasting Intent": {
      invoke: {
        src: "broadcastMessage",

        input: ({ context }) => {
          return {
            signatureData: context.signature,
            signerCredentials: context.signerCredentials,
            quoteHashes: context.quoteHashes,
          }
        },

        onError: {
          target: "Generic Error",
          description: "CANNOT_PUBLISH_INTENT",

          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: ({ event }) => ({
                reason: "ERR_CANNOT_PUBLISH_INTENT",
                error: toError(event.error),
              }),
            },
          ],
        },

        onDone: [
          {
            target: "Completed",
            guard: {
              type: "isOk",
              params: ({ event }) => event.output,
            },
            actions: {
              type: "setIntentHash",
              params: ({ event }) => {
                assert(event.output.tag === "ok")
                return event.output.value
              },
            },
          },
          {
            target: "Generic Error",
            actions: {
              type: "setError",
              params: ({ event }) => {
                assert(event.output.tag === "err")

                if (event.output.value.reason === "nonce_used") {
                  return { reason: "ERR_NONCE_USED", error: null }
                }

                return {
                  reason: "ERR_CANNOT_PUBLISH_INTENT",
                  server_reason: event.output.value.reason,
                }
              },
            },
          },
        ],
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
