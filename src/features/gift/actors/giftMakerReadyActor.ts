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

export type GiftMakerReadyActorInput = {
  parsed: {
    token: BaseTokenInfo | UnifiedTokenInfo
    amount: TokenValue
    message: string
  }
  raw: {
    token: BaseTokenInfo | UnifiedTokenInfo
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
  },
  actors: {
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
  /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOlwgBswBiMAJzoHs6SAHC9AFwDNnUSoubpwCy6ANb0ACgFcARhVyw8+KACUw3ANoAGALqJQrRrFydcjfIZAAPRAFoATADYAHCQDMAdlc6AjDoALDpufgCszgA0IACeDn4e7oGBvuGOOl6BAc4AvjnRaFgqxGSUNABiAJIAcpUAygASugZIIMam5pbWdgj2fv2OJH6O-X6BiV790XEIw14kKemuY2Guro4AnF4eeQUYOAQl5FTUAMIAgtWnAKIAMgD6APJqACLXas3W7WYWVq099jCkxIzi8W0CYSCGw2rg2HmmiDmC3WOmWELWm0muxAhQOhFImHQ+EwYAoilUAHEhJxqBBLGAyPgAG6MSQCaliSR0U5Eklkri-DTafRfEw-Lr-BzOIEgyYbML9DweTZ+BEIYIbEhhRyQlbJXzLbG44oE3mk8lQKnCWn0xkstmCYSc+g84nmgWWIVaPwtIxizp-UAAkaBEiwyGOHxeaPORwuNUarU6-wQ-WovxG-YmkiEt1kgiW6m0BjMNgcHh8dlOiQus38gNekWtb4B7rxfx+TwbHT+DZ+DaOZJheGxRBx9xbbzOfw6DxjMZePL5ED4RgQODWY2HIiijq-Nu9frToYjfrjVyTVWj3pxsIkDYpHSD1brZzJTNFbelKi78WB2xSpkWoZBeoIKgkmxqvYHiaiE6zDIOmRrLCH54iUuZ8haVqcL+raSr0bg6GGMF9r48obNOGxqoORGBC43b9nCgRvgOqHZtwBBKNgkC4fu+GAjKcbOM4-Z+NsSyOGqCqDM4HjDoOwRhIEcJhEuORAA */
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
    },
    cancellingGift: {
      invoke: {
        id: "giftMakerCancellationRef",
        src: "cancelGiftActor",
        input: ({ context }) => {
          return {
            ...context,
            token: context.parsed.token,
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
