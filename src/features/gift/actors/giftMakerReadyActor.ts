import type { WalletSignatureResult } from "src/types/swap"
import { type PromiseActorLogic, assign, setup } from "xstate"
import type { SignerCredentials } from "../../../core/formatters"
import { logger } from "../../../logger"
import type {
  BaseTokenInfo,
  TokenValue,
  UnifiedTokenInfo,
} from "../../../types/base"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import type { EscrowCredentials } from "../utils/generateEscrowCredentials"
import { giftMakerCancellationActor } from "./giftMakerCancellationActor"
import type {
  GiftMakerCancellationActorInput,
  GiftMakerCancellationActorOutput,
} from "./giftMakerCancellationActor"
import {
  type GiftMakerPublishingActorInput,
  type GiftMakerPublishingActorOutput,
  giftMakerPublishingActor,
} from "./giftMakerPublishingActor"

export type GiftMakerReadyActorInput = {
  parsed: {
    tokenIn: BaseTokenInfo | UnifiedTokenInfo
    amount: TokenValue
    message: string
  }
  raw: {
    tokenIn: BaseTokenInfo | UnifiedTokenInfo
    amount: string
    message: string
  }
  giftId: string
  usedNonceBase64: string
  multiPayload: MultiPayload
  signerCredentials: SignerCredentials
  signatureResult: WalletSignatureResult
  escrowCredentials: EscrowCredentials
}

type GiftMakerReadyActorErrors = { reason: "EXCEPTION" }

interface GiftMakerReadyActorContext extends GiftMakerReadyActorInput {
  giftId: string
  usedNonceBase64: string
  error: null | GiftMakerReadyActorErrors
}

export const giftMakerReadyActor = setup({
  types: {
    input: {} as GiftMakerReadyActorInput,
    context: {} as GiftMakerReadyActorContext,
    events: {} as { type: "FINISH" | "CANCEL_ORDER" },
    children: {} as {
      giftMakerPublishingRef: "publishingActor"
    },
  },
  actors: {
    publishingActor: giftMakerPublishingActor as unknown as PromiseActorLogic<
      GiftMakerPublishingActorOutput,
      GiftMakerPublishingActorInput
    >,
    cancelGiftActor: giftMakerCancellationActor as unknown as PromiseActorLogic<
      GiftMakerCancellationActorOutput,
      GiftMakerCancellationActorInput
    >,
  },
  actions: {
    logError: (_, event: { error: unknown }) => {
      logger.error(event.error)
    },
    setError: assign({
      error: (_, error: GiftMakerReadyActorErrors) => error,
    }),
  },
  guards: {
    isTrue: (_, value: boolean) => value,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOlwgBswBiAMQEkA5egZQAkBtABgF1FQADgHtYuAC64h+fiAAeiAIxKSANgBMATgUAWAMy6uAdhUKNulQBoQAT0XaArCVOGl9+wvtajAX29W0WHiEpORU1ADCAIKM4QCiADIA+gDyAEoAIrGp3HxIIMKiElIy8ggAtGqGaiSVus669ioqhmZWtghNJNoAHGpc3UpcdU1Kvv4YOATEJJjo+JhgFBQEUMkAThBga9QQUmBk+ABuQgDW+0JimACy6Gdr65tr4XMLS+hF+KlgAGY5MgXiSTSPKlMq6QyOAzdBrmLhNFq6NqIXRqXSqezglzqFRcNT2Lj2MYgAKTYIzF6LZb4VYbLY7PYHY5nEgXa63LYPLbPeaU95Ar6-BS5QQiQHFEGIMHdQxdBS6XqoxrNVo2RDaNQqGoGDRcOFcDzuNREklBaazHlLFac7ZbNZCNYkAQUd7fe2oFmXG53a3c17Oj4Cv55AEfEqSwwGLq6DQmewDbraHHdJEIBQqNHRhx4jTGTwOQy+PwgfBCTbwPImqZEf6i0MS8qGQzdKMxjzxxP9FNlBR4kj6hQuFG4hPabQaY0TU0hShgGuFIFh8pqXvg-oYnHwlXtMEy9wDrhmEYOMcqCeBKvki1UmmPOdi4GgUHyhSqPrdddw5WI1WplSQ7S5geuYaImZ6ktM3wELgsDYJAd51o+iA6iQGgYuYfT2MYpi6NoKZDihQyNmmGq4vihKFkAA */
  context: ({ input }) => ({
    ...input,
    error: null,
  }),

  initial: "idle",

  states: {
    idle: {
      on: {
        FINISH: "finished",
        CANCEL_ORDER: "cancellingGift",
      },
      invoke: {
        id: "giftMakerPublishingRef",
        src: "publishingActor",
        input: ({ context }) => {
          return {
            giftId: context.giftId,
            nonceBas64: context.usedNonceBase64,
            multiPayload: context.multiPayload,
            signatureResult: context.signatureResult,
            signerCredentials: context.signerCredentials,
            escrowCredentials: context.escrowCredentials,
          }
        },
        onError: {
          target: "idle",
          actions: [
            { type: "logError", params: ({ event }) => event },
            { type: "setError", params: { reason: "EXCEPTION" } },
          ],
        },
      },
    },

    cancellingGift: {
      invoke: {
        id: "giftMakerCancellationRef",
        src: "cancelGiftActor",
        input: ({ context }) => {
          return {
            giftId: context.giftId,
            escrowCredentials: context.escrowCredentials,
            signerCredentials: context.signerCredentials,
            multiPayload: context.multiPayload,
            tokenIn: context.parsed.tokenIn,
          }
        },
        onDone: [
          {
            target: "finished",
            guard: {
              type: "isTrue",
              params: ({ event }) =>
                event.output.giftStatus === "cancelled" ||
                event.output.giftStatus === "already_cancelled_or_executed",
            },
          },
          "idle",
        ],
        onError: {
          target: "idle",
          actions: [
            { type: "logError", params: ({ event }) => event },
            { type: "setError", params: { reason: "EXCEPTION" } },
          ],
        },
      },
    },

    finished: {
      type: "final",
    },
  },
})
