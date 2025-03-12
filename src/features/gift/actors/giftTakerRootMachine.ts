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
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import { type GiftInfo, getGiftInfo } from "../utils/getGiftInfo"
import { signGiftTakerMessage } from "../utils/signGiftTakerMessage"
import {
  type GiftMakerPublishingActorInput,
  type GiftMakerPublishingActorOutput,
  giftMakerPublishingActor,
} from "./giftMakerPublishingActor"

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
        giftInfo: GiftInfo
        signerCredentials: SignerCredentials
      }
    },
  },
  actors: {
    openSecretActor: fromPromise(
      async ({
        input,
      }: {
        input: {
          secretKey: string
          tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
        }
      }) => {
        const giftInfoResult = await getGiftInfo(
          input.secretKey,
          input.tokenList
        )

        if (giftInfoResult.isErr()) {
          return {
            tag: "err",
            value: {
              reason: giftInfoResult.unwrapErr(),
            },
          }
        }
        return {
          tag: "ok",
          value: {
            giftInfo: giftInfoResult.unwrap(),
          },
        }
      }
    ),
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
  /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOlwgBswBiAYQHkA5AMQEkAlAWQH1aAZAIKtOAbQAMAXUSgADgHtYuAC645+aSAAeiALQA2PWJIB2AIxixAVgCcp0zYAcAFgBMAGhABPXaYfWSTsbGLmLGAMym1lbWTnoAvnEeaFh4hKRyMmD4AMpgmABOYErUEGpgZPgAbnIA1uUZWbkFRexgAGbiUkgg8ooqahraCPrW-sZ6DnpOYdYuseZhHt7DYQ5GxpPBEy4OpnrW8YkgyTgExCSYFOi4qARQJIpQ+HclZRXVdQ+4T3etHZIaXrKVTqbpDEZ6EhiBwOCJOMSrMTWXZLRAuUwuExhMwTCx6UxOSLWBJJDCnNIXK43O5fH74KCvQjvWrlR7Pel-ESmLqyBTAgZg3RhSyYsQuOYuKLGMR6SyxSyohDozHhMwHCZ7SzYsIk45k1LnS7XW702nshlgfL5OT5EgyK5KNo21Bm37tTqAvn9UGgcHIywkSyWIKSlxhQyRRZeRDwkguLXC5zS7EIw6klJnUhG6mmmQAVwARhRcLBUgzSkyCB9yicDVmqSb7vmiyWywgq3JMOhvZ0Pd0gd7BrpjISSHodvs1aq9FHllrjCYLJZfE5LAiZbra5nKcaac3i6WXhXyh3PluKdnG3bCwe2x2uz3JFyeT0vSChytViY14iZtDkc4irzouVgrj+G5HOehoNnuN6ti8lrWra9rdk6+QulB9a7rmcGHvS7ZVJ23Ygr2AL9m+Aq+j4FimCQYSxLCDjGAc8amLOiDhpCjGmCOwb7HK0wJEc+ByBAcAaJhnp9O+grDHYq4mMEOyuJKfirIqOiBEYERiGxVgwmIrgOJYm76tu5BUFJ-I+louj4kYNh6EEQQGJK6nRsM8aQuKMLmJYUyEvRpkZhSDQ5HkhRKFZg6yTo5jWAuIbKeKyLWO5yw6KsmK7LpOw7DEYRisF5LQdhUDRTJVHDOM2lLquGJIoV7HDA4KppSK462KEThOMSkFmReMGmmydwVZRtnVXYJDWEGIpsXK47BkBtHSrKuWBEZLnFXWO45k2uFlmNNngmYmKFVY9UhGlCKKuGTgkLsgT2OMsTSi4xjbdul6QEdH76GYD2tTY4xBLpKIeU5kJRGlI6TGEOwjp9FLoAWNpKD95HSeN4LxgG8YIpYzgylEWoOIqkPTY1sMzgjhwJEAA */
  context: ({ input }) => ({
    ...input,
    error: null,
    giftInfo: null,
    multiPayload: null,
    intentHashes: null,
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
          },
        ],
      },
    },
    claiming: {
      entry: "clearError",

      initial: "signing",

      states: {
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

            onError: {
              target: "#(machine).idle",
              actions: [
                { type: "logError", params: ({ event }) => event },
                { type: "setError", params: { reason: "CANNOT_SIGN_GIFT" } },
              ],
            },

            onDone: [
              {
                target: "publishing",
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
              {
                target: "#(machine).idle",
                actions: {
                  type: "setError",
                  params: { reason: "CANNOT_SIGN_GIFT" },
                },
              },
            ],
          },
        },
        publishing: {
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
                target: "#(machine).claimed",
                actions: assign({
                  intentHashes: ({ event }) => {
                    assert(event.output.giftStatus === "published")
                    return event.output.intentHashes
                  },
                }),
              },
              {
                target: "#(machine).aborted",
                actions: assign({
                  error: () => ({
                    reason: "CANNOT_CLAIM_GIFT" as const,
                  }),
                }),
              },
            ],
            onError: {
              target: "#(machine).idle",
              actions: [{ type: "logError", params: ({ event }) => event }],
            },
          },
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
