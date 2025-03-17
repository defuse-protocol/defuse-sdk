import { type PromiseActorLogic, assign, setup } from "xstate"
import type { SignerCredentials } from "../../../core/formatters"
import { logger } from "../../../logger"
import type {
  BaseTokenInfo,
  TokenValue,
  UnifiedTokenInfo,
} from "../../../types/base"
import type { EscrowCredentials } from "../utils/generateEscrowCredentials"
import type { GiftInfo } from "../utils/getGiftInfo"
import {} from "../utils/parseMultiPayload"
import {
  type GiftClaimActorOutput,
  giftClaimActor,
} from "./shared/giftClaimActor"

export type GiftMakerReadyActorInput = {
  giftId: string
  giftInfo: GiftInfo
  signerCredentials: SignerCredentials
  escrowCredentials: EscrowCredentials
  parsed: {
    token: BaseTokenInfo | UnifiedTokenInfo
    amount: TokenValue
    message: string
  }
}

type GiftMakerReadyActorErrors = { reason: "EXCEPTION" }

interface GiftMakerReadyActorContext extends GiftMakerReadyActorInput {
  giftId: string
  error: null | GiftMakerReadyActorErrors
}

export const giftMakerReadyActor = setup({
  types: {
    input: {} as GiftMakerReadyActorInput,
    context: {} as GiftMakerReadyActorContext,
    events: {} as { type: "FINISH" | "CANCEL_GIFT" },
    children: {} as {
      giftMakerClaimRef: "claimGiftActor"
    },
  },
  actors: {
    claimGiftActor: giftClaimActor as unknown as PromiseActorLogic<
      GiftClaimActorOutput,
      void
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
        CANCEL_GIFT: "cancelling",
      },
    },
    cancelling: {
      invoke: {
        id: "giftMakerClaimRef",
        src: "claimGiftActor",
        input: ({ context }) => {
          return {
            giftInfo: context.giftInfo,
            signerCredentials: context.signerCredentials,
          }
        },
        onDone: [
          {
            target: "finished",
            guard: {
              type: "isTrue",
              params: ({ event }) =>
                event.output.giftStatus === "claimed" ||
                event.output.giftStatus === "already_claimed_or_executed",
            },
          },
          {
            target: "idle",
            actions: [
              {
                type: "logError",
                params: {
                  error: { reason: "EXCEPTION" },
                },
              },
            ],
          },
        ],
      },
    },

    finished: {
      type: "final",
    },
  },
})
