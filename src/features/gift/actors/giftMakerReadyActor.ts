import { assign, setup } from "xstate"
import type { SignerCredentials } from "../../../core/formatters"
import { logger } from "../../../logger"
import type {
  BaseTokenInfo,
  TokenValue,
  UnifiedTokenInfo,
} from "../../../types/base"
import type { MultiPayload } from "../../../types/defuse-contracts-types"

export type GiftMakerReadyActorInput = {
  parsed: {
    tokenIn: BaseTokenInfo | UnifiedTokenInfo
    amountIn: TokenValue
  }
  raw: {
    tokenIn: BaseTokenInfo | UnifiedTokenInfo
    amountIn: string
  }
  giftId: string
  usedNonceBase64: string
  multiPayload: MultiPayload
  signerCredentials: SignerCredentials
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
      otcMakerOrderCancellationRef: "cancelOrderActor"
    },
  },
  //@ts-expect-error
  actors: {},
  actions: {
    //@ts-expect-error
    logError: (_, event: { error: unknown }) => {
      logger.error(event.error)
    },
    setError: assign({
      error: (_, error: GiftMakerReadyActorErrors) => error,
    }),
  },
  guards: {
    //@ts-expect-error
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
      },
    },

    finished: {
      type: "final",
    },
  },
})
