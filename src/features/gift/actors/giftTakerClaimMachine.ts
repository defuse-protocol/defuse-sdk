import { assert } from "src/utils/assert"
import {
  type PromiseActorLogic,
  assertEvent,
  assign,
  fromPromise,
  setup,
} from "xstate"
import {
  type SignerCredentials,
  formatSignedIntent,
} from "../../../core/formatters"
import { logger } from "../../../logger"
import type { PublishIntentsErr } from "../../../services/intentService"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import type { GiftInfo } from "../utils/getGiftInfo"
import { signGiftTakerMessage } from "../utils/signGiftTakerMessage"
import {
  type GiftMakerPublishingActorInput,
  type GiftMakerPublishingActorOutput,
  giftMakerPublishingActor,
} from "./giftMakerPublishingActor"

export type GiftMakerClaimedActorOutput = {
  giftStatus: "claimed" | "not_claimed" | "already_claimed_or_executed"
}

type GiftTakeClaimErr = {
  reason: "CANNOT_SIGN_GIFT" | "CANNOT_CLAIM_GIFT"
}

type GiftTakerClaimingActorErrors = PublishIntentsErr | GiftTakeClaimErr

type GiftTakerClaimingOutput =
  | {
      tag: "ok"
      value: {
        intentHashes: string[]
      }
    }
  | {
      tag: "err"
      value: GiftTakerClaimingActorErrors
    }

type GiftTakerClaimMachineContext = {
  error: null | GiftTakerClaimingActorErrors
  multiPayload: null | MultiPayload
  intentHashes: null | string[]
}

export const giftTakerClaimMachine = setup({
  types: {
    context: {} as GiftTakerClaimMachineContext,
    output: {} as GiftTakerClaimingOutput,
    events: {} as {
      type: "CONFIRM_CLAIM"
      params: {
        giftInfo: GiftInfo
        signerCredentials: SignerCredentials
      }
    },
  },
  actors: {
    signingActor: fromPromise(
      async ({
        input,
      }: {
        input: { giftInfo: GiftInfo; signerCredentials: SignerCredentials }
      }) => {
        const signGiftResult = await signGiftTakerMessage({
          giftInfo: input.giftInfo,
          signerCredentials: input.signerCredentials,
        })
        if (signGiftResult.isErr()) {
          return {
            tag: "err",
            value: {
              reason: "CANNOT_SIGN_GIFT",
            },
          }
        }
        const multiPayload = formatSignedIntent(
          signGiftResult.unwrap(),
          input.signerCredentials
        )
        return {
          tag: "ok",
          value: {
            multiPayload,
          },
        }
      }
    ),
    publishingActor: giftMakerPublishingActor as unknown as PromiseActorLogic<
      GiftMakerPublishingActorOutput,
      GiftMakerPublishingActorInput
    >,
  },
  actions: {
    logError: (_, event: { error: unknown }) => {
      logger.error(event.error)
    },
    setError: assign({
      error: (_, error: GiftTakerClaimingActorErrors) => error,
    }),
    clearError: assign({ error: null }),
  },
  guards: {
    isOk: (_, params: { tag: "ok" | "err" }) => params.tag === "ok",
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOlwgBswBiAYQHkA5AMQEkAlAWQH1aAZAIKtOAbQAMAXUSgADgHtYuAC645+aSAAeiALQAmAOwBmEkaMA2Q+bEBOAKxmALObsAaEAE9dARgAc3knN-byNfUKCQvT0AX2j3NCw8QlJyKmoBACF6dgAVXkFhcSkkEHlFFTUNbQRvA0cSXxtveyM9MUM9Xz03T0RzAMdfRzFvRzshmzFnI1j4jBwCYhJFKHwCKGoINTAyfAA3OQBrHZW1-Ch2MAAzIo0y5VV1Eur9G18G3wMxOzsDPW9zI4DOZ3F4alESGIjHYxN8LOYbE1HDM4iAEgtkiRMBR0LhUOtNttdgdjiR0UkltjcfjzggCAdMOgKvgircSvdmVVdK16uZgd5vDCfjY9GNQYg7HoTDZrEDPkZBYDZmj5hTSFS8QStoRiUcduTFuqcZrafS5IzmazvMVZAoHpVnohESQDADakZBm9fBNxQgYWISG8jEibI4bBZHI5lQbMRqaRswAAnRNyRMkGQ4pRXVOoMmqw1Y43xun7c1Mx6syR3O2cx0IHQOOyB7xiXzjPSAqY9MENgwkQajAyNX6TToA2Ko-ByCBwDQx4jV8qPLn18bSlttrqdsW9evQptfPxGYwGSVQ6P5zGpMCL+1PUAvKImKJ6N4hLp+De+-RBEhtPzTKMIxhheiQFqc6y3rWD7cqKLp2I4UTmP04zNDK35DCQQpiOYEantCUaovORrUpB7I1sudavE2HoGG8a5hnRvy+q+9TIsMNjAp8dHnkRl6UkWkBQZRMH1h2Ab+M4rbQqKZgGAYvp8uYga2Megy4Z0dSgRiSzoAARqmShCeRS4OqJR5-m6fyylCkaKcCKnhnUvgaZ8hGxEAA */
  context: ({ input }) => ({
    ...input,
    error: null,
    multiPayload: null,
    intentHashes: null,
  }),

  initial: "idle",

  states: {
    idle: {
      on: {
        CONFIRM_CLAIM: "signing",
      },
    },
    signing: {
      invoke: {
        id: "signingRef",
        src: "signingActor",

        input: ({ event }) => {
          assertEvent(event, "CONFIRM_CLAIM")
          return {
            giftInfo: event.params.giftInfo,
            signerCredentials: event.params.signerCredentials,
          }
        },

        onDone: [
          {
            target: "claiming",
            guard: ({ event }) => event.output.tag === "ok",
            actions: assign({
              multiPayload: ({ event }) => {
                assert(
                  event.output.value.multiPayload,
                  "multiPayload is not defined"
                )
                return event.output.value.multiPayload
              },
            }),
          },
        ],
      },
    },
    claiming: {
      invoke: {
        src: "publishingActor",
        input: ({ context }) => {
          const multiPayload = context.multiPayload
          assert(multiPayload, "multiPayload is not defined")
          return {
            multiPayload,
          }
        },
        onDone: [
          {
            guard: ({ event }) => {
              return event.output.giftStatus === "published"
            },
            target: "claimed",
            actions: assign({
              intentHashes: ({ event }) => {
                assert(event.output.giftStatus === "published")
                return event.output.intentHashes
              },
            }),
          },
          {
            target: "aborted",
            actions: assign({
              error: () => ({
                reason: "CANNOT_CLAIM_GIFT" as const,
              }),
            }),
          },
        ],
        onError: {
          target: "idle",
          actions: [{ type: "logError", params: ({ event }) => event }],
        },
      },
    },
    claimed: {
      type: "final",
    },
    aborted: {
      type: "final",
    },
  },
})
