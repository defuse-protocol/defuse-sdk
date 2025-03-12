import { assertEvent, assign, fromPromise, setup } from "xstate"
import type { SignerCredentials } from "../../../core/formatters"
import { formatSignedIntent } from "../../../core/formatters"
import { logger } from "../../../logger"
import {
  type PublishIntentsErr,
  publishIntents,
} from "../../../services/intentService"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import type {
  NEP413SignatureData,
  WalletSignatureResult,
} from "../../../types/swap"
import { assert } from "../../../utils/assert"
import type { EscrowCredentials } from "../utils/generateEscrowCredentials"
import { deriveSecretKey, parseGiftSecret } from "../utils/parseGiftSecret"
import { signGiftTakerMessage } from "../utils/signGiftTakerMessage"

export type GiftMakerCancellationActorInput = {
  giftId: string
  signerCredentials: SignerCredentials
  escrowCredentials: EscrowCredentials
  multiPayload: MultiPayload
  token: BaseTokenInfo | UnifiedTokenInfo
}

export type GiftMakerCancellationActorOutput = {
  giftStatus: "cancelled" | "not_cancelled" | "already_cancelled_or_executed"
}

type CancellationErrors = {
  reason:
    | "EXCEPTION"
    | "CANNOT_PARSE_GIFT_MULTIPAYLOAD"
    | "CANNOT_PARSE_SECRET_KEY"
    | "CANNOT_FORMAT_SIGNED_INTENT"
}

type GiftMakerSignCancellationOutput =
  | {
      tag: "ok"
      value: {
        signerCredentials: SignerCredentials
        signatureResult: NEP413SignatureData
        multiPayload: MultiPayload
      }
    }
  | {
      tag: "err"
      value: CancellationErrors
    }

type GiftMakerCancellationActorErrors = PublishIntentsErr | CancellationErrors

type GiftMakerCancellationActorContext = {
  giftId: string
  escrowCredentials: EscrowCredentials
  signerCredentials: SignerCredentials
  multiPayload: MultiPayload
  token: BaseTokenInfo | UnifiedTokenInfo
  error: null | GiftMakerCancellationActorErrors
}

export const giftMakerCancellationActor = setup({
  types: {
    input: {} as GiftMakerCancellationActorInput,
    output: {} as GiftMakerCancellationActorOutput,
    context: {} as GiftMakerCancellationActorContext,
    events: {} as
      | {
          type: "ABORT_CANCELLATION" | "ACK_CANCELLATION_IMPOSSIBLE"
        }
      | {
          type: "CONFIRM_CANCELLATION"
        }
      | {
          type: "_INTERNAL_SIGNED"
          multiPayload: MultiPayload
          signatureResult: WalletSignatureResult
          signerCredentials: SignerCredentials
        },
  },
  actors: {
    signActor: fromPromise(
      async ({
        input,
      }: {
        input: {
          signerCredentials: SignerCredentials
          escrowCredentials: EscrowCredentials
          multiPayload: MultiPayload
          token: BaseTokenInfo | UnifiedTokenInfo
        }
      }) => {
        // We need to extract tokenDiff from the original gift intent to reclaim it
        if (input.multiPayload.standard !== "nep413") {
          return {
            tag: "err" as const,
            value: { reason: "CANNOT_PARSE_GIFT_MULTIPAYLOAD" as const },
          }
        }

        const giftMultiPayload = JSON.parse(input.multiPayload.payload.message)
        // we can use direct extraction safely now as we don't support multiple tokens in a gift
        const tokenDiff = giftMultiPayload.intents[0].tokens

        const parseResult = parseGiftSecret(
          deriveSecretKey(input.escrowCredentials, "nep413")
        )
        if (parseResult.isErr()) {
          return {
            tag: "err" as const,
            value: { reason: "CANNOT_PARSE_SECRET_KEY" as const },
          }
        }

        const giftInfo = {
          tokenDiff,
          token: input.token,
          secretKey: parseResult.unwrap().secretKey,
          userId: parseResult.unwrap().userId,
        }

        const signature = await signGiftTakerMessage({
          giftInfo,
          signerCredentials: input.signerCredentials,
        })

        const multiPayload = formatSignedIntent(
          signature.unwrap(),
          input.signerCredentials
        )
        if (signature.isErr()) {
          return {
            tag: "err" as const,
            value: { reason: "CANNOT_FORMAT_SIGNED_INTENT" as const },
          }
        }
        return {
          tag: "ok" as const,
          value: {
            signerCredentials: input.signerCredentials,
            signatureResult: signature.unwrap(),
            multiPayload,
          },
        }
      }
    ),
    publishActor: fromPromise(
      ({ input }: { input: { multiPayload: MultiPayload } }) => {
        return publishIntents({
          quote_hashes: [],
          signed_datas: [input.multiPayload],
        }).then((result) => {
          if (result.isErr()) {
            return { tag: "err" as const, value: result.unwrapErr() }
          }
          const intentHashes = result.unwrap()
          const intentHash = intentHashes[0]
          assert(intentHash != null)
          return { tag: "ok" as const, value: intentHash }
        })
      }
    ),
  },
  actions: {
    logError: (_, event: { error: unknown }) => {
      logger.error(event.error)
    },
    setError: assign({
      error: (_, error: GiftMakerCancellationActorErrors) => error,
    }),
    clearError: assign({ error: null }),

    completeSigning: (
      { self },
      event: { output: GiftMakerSignCancellationOutput }
    ) => {
      assert(event.output.tag === "ok")
      self.send({ type: "_INTERNAL_SIGNED", ...event.output.value })
    },
  },
  guards: {
    isOk: (_, params: { tag: "ok" | "err" }) => params.tag === "ok",
    isNonceUsedError: (
      _,
      event: {
        output: { tag: "err"; value: PublishIntentsErr } | { tag: "ok" }
      }
    ) => {
      return (
        event.output.tag === "err" &&
        event.output.value.reason === "RELAY_PUBLISH_NONCE_USED"
      )
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOlwgBswBiAYQHkA5AMQEkAlAWQH1aBBRrQCiAGRF8AKqyYBtAAwBdRKAAOAe1i4ALrjX5lIAB6IAnADYArCQCMcuSYAsZ2w5MB2RwBoQAT0TWHEgAmMwAOaxNrawtHAGYzSIBfRO80LDxCUnIqaj4AIXp2CV4BYTFJaUZ5JSQQdU0dPQNjBGszIJMSZwdrIKjYiyCLOVjvPwQLUM7QtyCZ6zczVxNQs2TUjBwCYjJKMABVfEx0I7AKCnQAIxy+WgBpEsFRcSkmblZOAAV6AGUf1jyIiE1QM9W0un0tRaJgGJFCcg8ciCsVCQQcQTGiFCDkC4TcDjc1lCxNicmssXWIDSW0yJGOp3OBCgJE0UHwTOoED0YDI+AAbmoANY81n4dhgABmINqYMakNALRRgWR9jkziRc1CmIQ5hIDjVlgsi1C8RmDkp1IyO3pmDOFCZLNwbI5XMIvIFwsdbPFUusNVUGnBTShiFmQTh8MGZJ6bmGJm1uv1ZnVgzcs1jFgtmytpBtdodoo5YAATsW1MWSCoLloJeXUF6xZLpQGGhDmoh0VYyWZVTETJFUdrkWYbH0UcSZuFx1n0ttcydbYz8MzC8vqO9GBIhOxGHwRNx-gBxRhCAAizbqgbl7dabRIclT4SCQTcD9Cg21PVCJEcJp6ESCBE2hnGlrQXfNl0rABXa5cFgDIoE5bl3SFHlLTnOlwKXZkVBg+14KZBACAFY45WqC9ZTbEMEHaPV-0GdxFnJSJtVmEc0WiCwiTVEwLApFIqWzDC82w6DYIItdXR5YjUJIdDaRE+1INw8SEKI-k1FIiFyL9UEryohUO2xGxSUJMkiWiXjWJCYIegsLj4QSPiQJzTCGSUnC8LghCkLdGTPXksD3IdFT8LUmStL0cign9S9W2DQydQcWIbC42YHJxNwtV8UMRmCJZzCiSwnyCFzhKwjyxLCotS3LStq1rYt60C+dguUryJKgdSSPQMjFAo-SEqMDt7GCF9u1iBx7Km-FtQsVwbAWFE5Dxea3H4gT8DUCA4AMFq9Pi+VhoQcN2jRHtYliDpiXMJxtQAWl6KwYku1xoliaJ31CMraWyMADqDI6WhcTpYlfJxn0mvjsvGSZplmeZFmWVYfp2P7DkUq4qAB69qKNTpIkmNEOkGdF4xyhBsVxBYCSJEkyVKgSWrcxcPJxgzjuGLpnycEYrpWKZLAelF7xhS6TA1LKqdR1rWYLJ12WXdmhuhb8zt5y7rsFocohII0zEWMk+Jxck3BllmIM81SmWVoH-F6CMHFRDwndcJ25p7PXX2Gd7ePcc0maEhSKsgW2b36PXJqmIZeOTYltWxFKLAN9E0w+2M1kD2daSgo4Kqx-6ZUGu3Wn1QJnCcpwDexbEE+SvWU5fdaFmT6xzaucstFDovDvDg3w3sd8+lceaFjMOuk8btOW+cZJkiAA */
  context: ({ input }) => ({
    ...input,
    error: null,
  }),

  output: ({ event }) => {
    return event.output as GiftMakerCancellationActorOutput
  },

  initial: "idle",

  states: {
    idle: {
      on: {
        CONFIRM_CANCELLATION: "cancelling",
        ABORT_CANCELLATION: "aborted",
      },
    },

    idleUncancellable: {
      on: {
        ACK_CANCELLATION_IMPOSSIBLE: "uncancellable",
      },
    },

    cancelling: {
      entry: "clearError",

      initial: "signing",

      states: {
        signing: {
          invoke: {
            id: "signRef",
            src: "signActor",

            input: ({ context, event }) => {
              assertEvent(event, "CONFIRM_CANCELLATION")

              return {
                multiPayload: context.multiPayload,
                signerCredentials: context.signerCredentials,
                escrowCredentials: context.escrowCredentials,
                token: context.token,
              }
            },

            onError: {
              target: "#(machine).idle",
              actions: [
                { type: "logError", params: ({ event }) => event },
                { type: "setError", params: { reason: "EXCEPTION" } },
              ],
            },

            onDone: [
              {
                guard: {
                  type: "isOk",
                  params: ({ event }) => ({ tag: event.output.tag }),
                },
                actions: {
                  type: "completeSigning",
                  params: ({ event }) => ({
                    output: event.output,
                  }),
                },
              },
              {
                target: "#(machine).idle",
                actions: {
                  type: "setError",
                  params: ({ event }) => {
                    assert(event.output.tag === "err")
                    return event.output.value
                  },
                },
              },
            ],
          },

          on: {
            _INTERNAL_SIGNED: {
              target: "publishing",
            },
          },
        },

        publishing: {
          invoke: {
            src: "publishActor",

            input: ({ event }) => {
              assertEvent(event, "_INTERNAL_SIGNED")

              return {
                signerCredentials: event.signerCredentials,
                signature: event.signatureResult,
                multiPayload: event.multiPayload,
              }
            },

            onError: {
              target: "#(machine).idle",
              actions: [
                { type: "logError", params: ({ event }) => event },
                { type: "setError", params: { reason: "EXCEPTION" } },
              ],
            },

            onDone: [
              {
                target: "#(machine).cancelled",
                guard: {
                  type: "isOk",
                  params: ({ event }) => event.output,
                },
                // actions: "removeTrade",
              },
              {
                target: "#(machine).idleUncancellable",
                guard: {
                  type: "isNonceUsedError",
                  params: ({ event }) => event,
                },
                // actions: "removeTrade",
              },
              {
                target: "#(machine).idle",
                actions: {
                  type: "setError",
                  params: ({ event }) => {
                    assert(event.output.tag === "err")
                    return event.output.value
                  },
                },
              },
            ],
          },
        },
      },
    },

    cancelled: {
      type: "final",
      output: {
        giftStatus: "cancelled",
      } satisfies GiftMakerCancellationActorOutput,
    },

    uncancellable: {
      type: "final",
      output: {
        giftStatus: "already_cancelled_or_executed",
      } satisfies GiftMakerCancellationActorOutput,
    },

    aborted: {
      type: "final",
      output: {
        giftStatus: "not_cancelled",
      } satisfies GiftMakerCancellationActorOutput,
    },
  },
})
