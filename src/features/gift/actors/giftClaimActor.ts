import { type SignerCredentials, formatSignedIntent } from "src/core/formatters"
import type { MultiPayload } from "src/types/defuse-contracts-types"
import { assertEvent, assign, fromPromise, setup } from "xstate"
import { logger } from "../../../logger"
import {
  type PublishIntentsErr,
  publishIntents,
} from "../../../services/intentService"
import { assert } from "../../../utils/assert"
import type { GiftInfo } from "../utils/getGiftInfo"
import { signGiftTakerMessage } from "../utils/signGiftTakerMessage"

type GiftClaimActorErrors =
  | {
      reason: "ERR_ON_CLAIM_GIFT" | "ERR_ON_SIGN_GIFT" | "ERR_ON_PUBLISH_GIFT"
    }
  | PublishIntentsErr

type GiftClaimActorInput = {
  giftInfo: GiftInfo
  signerCredentials: SignerCredentials
}

type GiftClaimActorContext = {
  error: null | GiftClaimActorErrors
  giftInfo: GiftInfo
  signerCredentials: SignerCredentials
}

type GiftSignGiftActorOutput =
  | {
      tag: "ok"
      value: { multiPayload: MultiPayload }
    }
  | { tag: "err"; value: GiftClaimActorErrors }

export type GiftClaimActorOutput =
  | {
      tag: "ok"
      value: {
        intentHashes: string[]
      }
    }
  | {
      tag: "err"
      value: GiftClaimActorErrors
    }

export const giftClaimActor = setup({
  types: {
    input: {} as GiftClaimActorInput,
    output: {} as GiftClaimActorOutput,
    context: {} as GiftClaimActorContext,
    events: {} as {
      type: "_INTERNAL_SIGNED"
      params: {
        multiPayload: MultiPayload
      }
    },
  },
  actors: {
    signGiftActor: fromPromise(
      async ({
        input,
      }: { input: GiftClaimActorInput }): Promise<GiftSignGiftActorOutput> => {
        try {
          const signature = await signGiftTakerMessage({
            giftInfo: input.giftInfo,
            signerCredentials: input.signerCredentials,
          })
          const multiPayload = formatSignedIntent(
            signature,
            input.signerCredentials
          )
          return {
            tag: "ok",
            value: {
              multiPayload,
            },
          }
        } catch {
          return {
            tag: "err",
            value: { reason: "ERR_ON_SIGN_GIFT" },
          }
        }
      }
    ),
    publishGiftActor: fromPromise(
      async ({
        input,
      }: {
        input: { multiPayload: MultiPayload }
      }): Promise<GiftClaimActorOutput> => {
        const result = await publishIntents({
          quote_hashes: [],
          signed_datas: [input.multiPayload],
        })
        if (result.isErr()) {
          return { tag: "err" as const, value: result.unwrapErr() }
        }
        const intentHashes = result.unwrap()
        if (intentHashes.length === 0) {
          return {
            tag: "err" as const,
            value: { reason: "ERR_ON_PUBLISH_GIFT" },
          }
        }
        return {
          tag: "ok",
          value: { intentHashes },
        }
      }
    ),
  },
  actions: {
    logError: (_, event: { error: unknown }) => {
      logger.error(event.error)
    },
    setError: assign({
      error: (_, error: GiftClaimActorErrors) => error,
    }),
    clearError: assign({ error: null }),
    completeSigning: (
      { self },
      event: { output: { tag: "ok"; value: { multiPayload: MultiPayload } } }
    ) => {
      assert(event.output.tag === "ok")
      self.send({ type: "_INTERNAL_SIGNED", params: event.output.value })
    },
  },
  guards: {
    isOk: (_, params: { tag: "ok" | "err" }) => params.tag === "ok",
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOlwgBswBiAYQBkBBASQFkB9AcWYDEAVANoAGALqJQABwD2sXABdcU-OJAAPRAFYATABoQAT0QAOAIwkALAE5rRy6fNCTWreYC+rvWix5CpTBXRcVAIoElkofBDqCCUwMnwANykAazjw-E5cADM5ACUwLOExJBBpWQUlFXUEAHYakiEAZiMaywA2RzaW1qM9QwRGoQ0GoSMhcZqNQcatNvdPDBwCYhJ-QOD8UPSosAAnXaldkgkAuSzD1DDcCMyc-MLRFTL5RWUS6vazGvMtITstRoaDQmNqNPqIExGcwkGptIEaIQ1KEudqNeYgLxLXyrAJBEJXCJRdjMAByfAAorkSYx6OwAMrMTgk8kAESKTxkL0q70QjXMZhMDi0lhm2laLg04IGlmhkx6k0s4x+lnRmJ8KzWeM2xwArgAjCi4WA+KDRWLxJKpXUGo3YW55ArskrPCpvUAfGpfH5-IwAoEgsEGRDmOEkJxWGp-LSmayNNEeDGLdV+XEbUISfWG41RGKEC0pOIZm3G+33AQmYqSTmuqqIT4w73-QHA0FSrRIkhaSFtRVGGYA4WqpPLFPrfFFrMm6h7A5HE7oM4Xa2T0uOx7O6uvWsISyehu-Jv+1tBgZ7tqevujMZdtomdwJ-BSCBwFRqkcc8pbnkIAC0VhIQJWB0SLAdYUo-m0IzjIiNSNEisHtBoQ7eCOZCUGAH5cm6agQtGWgkKCsx1C0Iq+m2u4kFC2hTK0fLdMhWIaqmISYTW34-mYgHtIiRigYq0ZSiYkYAaMEz8vyQLfAxyY4mO2rbJsrFfu6waQeY5gIo0lhdlpvwmFKgL1AiYxCD2XSKkhCZvtimppsutosRun7cipCAaOYRgkCKnqNHCu51CKBl7pMJmApYQIikIbhWcONmppASkuThCDhpYDSNCYTjWHUsHuVKIb4S0VguEJ4zNPG7hAA */
  context: ({ input }) => ({
    error: null,
    ...input,
  }),

  initial: "claiming",

  output: ({ event }) => {
    return event.output as GiftClaimActorOutput
  },

  states: {
    claiming: {
      entry: "clearError",

      initial: "signing",

      states: {
        signing: {
          invoke: {
            id: "signGiftRef",
            src: "signGiftActor",

            input: ({ context }) => {
              return {
                giftInfo: context.giftInfo,
                signerCredentials: context.signerCredentials,
              }
            },

            onError: {
              target: "#(machine).claiming",
              actions: [{ type: "logError", params: ({ event }) => event }],
            },

            onDone: [
              {
                guard: {
                  type: "isOk",
                  params: ({ event }) => {
                    return { tag: event.output.tag }
                  },
                },
                actions: [
                  {
                    type: "completeSigning",
                    params: ({ event }) => {
                      assert(event.output.tag === "ok")
                      return {
                        output: { tag: "ok", value: event.output.value },
                      }
                    },
                  },
                ],
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
            id: "publishGiftRef",
            src: "publishGiftActor",

            input: ({ event }) => {
              assertEvent(event, "_INTERNAL_SIGNED")
              return event.params
            },

            onError: {
              target: "#(machine).claiming",
              actions: [{ type: "logError", params: ({ event }) => event }],
            },

            onDone: [
              {
                target: "#(machine).claimed",
                guard: {
                  type: "isOk",
                  params: ({ event }) => event.output,
                },
              },
              {
                target: "#(machine).claiming",
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
    claimed: {
      type: "final",
      output: ({
        event,
      }: {
        event: { output: GiftClaimActorOutput }
      }) => event.output,
    },
  },
})
