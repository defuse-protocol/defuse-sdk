import { assert } from "src/utils/assert"
import { type PromiseActorLogic, assertEvent, assign, setup } from "xstate"
import type { SignerCredentials } from "../../../core/formatters"
import { logger } from "../../../logger"
import type { PublishIntentsErr } from "../../../services/intentService"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import type { GiftInfo } from "../utils/getGiftInfo"
import {
  type GiftClaimActorOutput,
  giftClaimActor,
} from "./shared/giftClaimActor"
import { giftOpenSecretActor } from "./shared/giftOpenSecretActor"

type GiftTakeClaimErr = {
  reason:
    | "CANNOT_SIGN_GIFT"
    | "CANNOT_CLAIM_GIFT"
    | "CANNOT_OPEN_GIFT_SECRET"
    | "NO_TOKEN_OR_GIFT_HAS_BEEN_CLAIMED"
}

type GiftTakerClaimingActorErrors = PublishIntentsErr | GiftTakeClaimErr

type GiftTakerRootMachineInput = {
  secretKey: string
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
}

type GiftTakerRootMachineContext = {
  error: null | GiftTakerClaimingActorErrors
  giftInfo: null | GiftInfo
  multiPayload: null | MultiPayload
  intentHashes: null | string[]
  secretKey: string
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
  signerCredentials: null | SignerCredentials
}

export type GiftMakerClaimedActorOutput = {
  giftStatus: "claimed" | "not_claimed" | "already_claimed_or_executed"
}

type GiftTakerRootMachineOutput =
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

export const giftTakerRootMachine = setup({
  types: {
    input: {} as GiftTakerRootMachineInput,
    context: {} as GiftTakerRootMachineContext,
    output: {} as GiftTakerRootMachineOutput,
    events: {} as {
      type: "CONFIRM_CLAIM"
      params: {
        signerCredentials: SignerCredentials
      }
    },
  },
  actors: {
    openSecretActor: giftOpenSecretActor,
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
      error: (_, error: GiftTakerClaimingActorErrors) => error,
    }),
    clearError: assign({ error: null }),
  },
  guards: {
    isOk: (_, params: { tag: "ok" | "err" }) => params.tag === "ok",
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOlwgBswBiAYQHkA5AMQEkAlAWQH1aAZAIKtOAbQAMAXUSgADgHtYuAC645+aSAAeiALQBOAExiSAVgAsAZjEA2E9YAce62b0B2ADQgAnonslXBmbWAQYGAIxG9q6u9gC+sZ5oWHiEpHIyYPgAymCYAE5gStQQamBk+ABucgDWZemZOfmF7GAAZuJSSCDyiipqGtoI+tZ6JNZiYbb2JuYGJhb2nj5DYXpmY3auYkFhYrMWFvGJGDgExCT12bkFRSWE5VW1FxlXTUot7WGdsgrKqupdQY6BbrPSGPQzLZmIyuCzWJa6VbrWzBbbWXb7Q4JEBJU6pEiYCjoXCoAhQYqlB41MqE4moADiuFaSgEmCUcjyHw6Gh6f36gN0bhMJAO4TMYhiFjBdgRCAM1gsJDBVnMMzc9gsdiOOJOKXOtJJZIp9wIjxpRJJjOZrPZnLaIi+PN+fQBoCBCusJGhegxVhioRMssCYRIE2cDhMrkhZjC8Wx+DkEDgGlxeqITt6-wGiO2rhIYVcq0LZhMYjmYVlOhjeaiYRjYTskaCJm1qbOpHIVAzfNdWl0UWM3pikxG0QblesBlDq1sBhiejhZiird17eeDWuhW7LuzQzBfg14U1ERMBnsoUrB2MFmLYohwSjrhXyTXBtJ+Cg26zAr3YPzhbcOtS3LCtvEQXYQzEKwDCsZwtigltsTbfE30gL9+TdQUy3zOF7DEewRzWNZZThUZC0LOYLHCOZ7Gsaxnzxc50AAIw5JQ0K6Xkdx-YEoP8VxoTPMILALKiYJIkZ-ALE8qJPWj6LjIA */
  context: ({ input }) => ({
    ...input,
    error: null,
    giftInfo: null,
    multiPayload: null,
    intentHashes: null,
    signerCredentials: null,
  }),

  initial: "openSecret",

  states: {
    idle: {
      on: {
        CONFIRM_CLAIM: "claiming",
      },
    },
    openSecret: {
      invoke: {
        id: "openSecretRef",
        src: "openSecretActor",

        input: ({ context }) => context,

        onDone: [
          {
            target: "idle",
            guard: ({ event }) => event.output.tag === "ok",
            actions: assign({
              giftInfo: ({ event }) => {
                assert(event.output.value.giftInfo, "giftInfo is not defined")
                return event.output.value.giftInfo
              },
            }),
          },
          {
            actions: assign({
              error: ({ event }) => {
                assert(event.output.tag === "err")
                return {
                  reason: event.output.value.reason,
                } as GiftTakerClaimingActorErrors
              },
            }),

            target: "aborted",
          },
        ],
      },
    },
    claiming: {
      entry: "clearError",

      invoke: {
        id: "claimGiftActorRef",
        src: "claimGiftActor",

        input: ({ context, event }) => {
          assertEvent(event, "CONFIRM_CLAIM")
          return {
            giftInfo: context.giftInfo,
            signerCredentials: event.params.signerCredentials,
          }
        },

        onDone: [
          {
            target: "claimed",
            guard: {
              type: "isOk",
              params: ({ event }) => event.output,
            },
            actions: assign({
              intentHashes: ({ event }) => {
                assert(event.output.tag === "ok")
                return event.output.value.intentHashes
              },
            }),
          },
          {
            target: "idle",
            actions: [
              {
                type: "logError",
                params: ({ event }) => ({ error: event.output.value }),
              },
            ],
          },
        ],
        onError: {
          target: "idle",
          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
          ],
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
