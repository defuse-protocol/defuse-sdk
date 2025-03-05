import { assign, fromPromise, setup } from "xstate"
import type { SignerCredentials } from "../../../core/formatters"
import { logger } from "../../../logger"
import {
  type PublishIntentsErr,
  publishIntents,
} from "../../../services/intentService"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import type { WalletSignatureResult } from "../../../types/swap"
import { assert } from "../../../utils/assert"
import type {
  Errors as SignIntentErrors,
  Output as SignIntentOutput,
} from "../../machines/signIntentMachine"
import type { SignMessage } from "../types/sharedTypes"

export type GiftMakerPublishingActorInput = {
  giftId: string
  nonceBas64: string
  signerCredentials: SignerCredentials
  multiPayload: MultiPayload
  signatureResult: WalletSignatureResult
}

export type GiftMakerPublishingActorOutput = {
  giftStatus: "published" | "not_published"
}

type GiftMakerPublishingActorErrors =
  | SignIntentErrors
  | PublishIntentsErr
  | { reason: "EXCEPTION" }

type GiftMakerPublishingActorContext = {
  giftId: string
  nonceBas64: string
  signerCredentials: SignerCredentials
  error: null | GiftMakerPublishingActorErrors
}

export const giftMakerPublishingActor = setup({
  types: {
    input: {} as GiftMakerPublishingActorInput,
    output: {} as GiftMakerPublishingActorOutput,
    context: {} as GiftMakerPublishingActorContext,
    events: {} as
      | {
          type: "ABORT_PUBLISHING" | "ACK_PUBLISHING_IMPOSSIBLE"
        }
      | {
          type: "CONFIRM_PUBLISHING"
          signerCredentials: SignerCredentials
          signMessage: SignMessage
        }
      | {
          type: "_INTERNAL_SIGNED"
          multiPayload: MultiPayload
          signatureResult: WalletSignatureResult
          signerCredentials: SignerCredentials
        },
  },
  actors: {
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
      error: (_, error: GiftMakerPublishingActorErrors) => error,
    }),
    clearError: assign({ error: null }),

    completeSigning: ({ self }, event: { output: SignIntentOutput }) => {
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
  /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOlwgBswBiAYQHkA5AMQEkAlAWQH0AFAVQBCAGVYBlABKtGAcQDaABgC6iUAAcA9rFwAXXBvyqQAD0QAmACwB2EhYBsZgKwAOM1cdXnjhRYsAaEABPRGcATgUSOwtnCzMARjiFAGY45zizAF8MgLQsPEJScipqAEFBenYAFT4hUUlpeWUjTW09AyNTBABaWItbBTs4izjQi1DHeKsA4IQrWJIrHzj3OxdnJIskrJyMHAJiMkowfnxMdFOwCgp0ACNiktoAaRqRcSlZblZOXnoxMVYRABRRQqJAgFq6fSGMGdOxJJK2KwjRaOJKhRZhaaIBIKOILObDTYKBSWBzbEC5PYFEhqACud1wsHyUGoEAMYDI+AAbhoANYcyn5A50hlMghQBAEHlnNr4EEg5paSHtGGILpmOyRXGOMa41Zw+xTILY4kInW9BRWcaWxyhcmC-akEUURnM1nszk8-kkB3U52u8WS7kaGVQ+VxUHqJWyjrmW0kJLOOZOJJWK2rLEIRLJEjmjWWbxJYlWe27IVO+kusX4FlswievkCsuOmmVgM1oPS9Cy+VmSPg6NQ2MIawRYlhRzLZxhdGhJKZzzOEjOOxpbxJqKLOylvIt-3VllgABOR40R5p1x0ADMz6gfc2-W2D52Q92w8oFWCITHVd0zElHEiLxUVCFMFEcOxwMzGIzBIeIbUtFI0yGLJshAfANAgOAjF9YhFVaIdfx6KxYIsAYhhGMYJmWTNVkAswlg8DUIIYu00Nwwojnw5VoVAToulSGxwLcBJrHGScIIXeZFmGFY1g2CwdypA4imOU5zkwS5rjuMBuJ-PjEAAwDlicCDvCY1JMxxPE002RZQjCdM4iU8tW1FZk9MIgyEAUaC7BsIYYiLLx4nRRT2IfYUn2wSBPJVbz-wWUDQjhTw5wGOF52NLNs1zSxE2cBRxg2TIIt3alaXUi4rluKg4t4kwTSKkgFDCdYRnSUZQis3KJk2XxPGiUCXJbW4zx0WKv0HeLGu6MjYJ8LrUkg0JVstHriTyzZpyK1FZNQjIgA */
  context: ({ input }) => ({
    ...input,
    error: null,
  }),

  output: ({ event }) => {
    return event.output as GiftMakerPublishingActorOutput
  },

  initial: "publishing",

  states: {
    idle: {
      on: {
        CONFIRM_PUBLISHING: "publishing",
        ABORT_PUBLISHING: "aborted",
      },
    },

    idleUncancellable: {
      on: {
        ACK_PUBLISHING_IMPOSSIBLE: "uncancellable",
      },
    },

    publishing: {
      actions: "clearError",

      invoke: {
        src: "publishActor",

        input: ({ event }) => {
          return {
            // @ts-expect-error
            signerCredentials: event.input.signerCredentials,
            // @ts-expect-error
            signature: event.input.signatureResult,
            // @ts-expect-error
            multiPayload: event.input.multiPayload,
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
            target: "#(machine).published",
            guard: {
              type: "isOk",
              params: ({ event }) => event.output,
            },
          },
          {
            target: "#(machine).idleUncancellable",
            guard: {
              type: "isNonceUsedError",
              params: ({ event }) => event,
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
    },

    published: {
      type: "final",
      output: {
        giftStatus: "published",
      } satisfies GiftMakerPublishingActorOutput,
    },

    uncancellable: {
      type: "final",
      output: {
        giftStatus: "not_published",
      } satisfies GiftMakerPublishingActorOutput,
    },

    aborted: {
      type: "final",
      output: {
        giftStatus: "not_published",
      } satisfies GiftMakerPublishingActorOutput,
    },
  },
})
