import {
  type ActorRefFrom,
  type PromiseActorLogic,
  assertEvent,
  assign,
  sendTo,
  setup,
} from "xstate"
import type { SignerCredentials } from "../../../core/formatters"
import { logger } from "../../../logger"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../../types/base"
import type { WalletMessage, WalletSignatureResult } from "../../../types/swap"
import { assert } from "../../../utils/assert"
import { toError } from "../../../utils/errors"
import {
  type Events as DepositedBalanceEvents,
  depositedBalanceMachine,
} from "../../machines/depositedBalanceMachine"
import {
  type EscrowCredentials,
  generateEscrowCredentials,
} from "../utils/generateEscrowCredentials"
import {
  getTokenDiffFromTransferMessage,
  parseMultiPayloadTransferMessage,
} from "../utils/parseMultiPayload"
import { giftMakerFormMachine } from "./giftMakerFormMachine"
import {
  type GiftMakerPublishingActorErrors,
  type GiftMakerPublishingActorInput,
  type GiftMakerPublishingActorOutput,
  giftMakerPublishingActor,
} from "./giftMakerPublishingActor"
import {
  type GiftMakerReadyActorInput,
  giftMakerReadyActor,
} from "./giftMakerReadyActor"
import type {
  GiftMakerSignActorErrors,
  GiftMakerSignActorInput,
  GiftMakerSignActorOutput,
  GiftMakerSignActorSuccess,
} from "./giftMakerSignActor"
import { giftMakerSignActor } from "./giftMakerSignActor"
import type { GiftInfo } from "./shared/getGiftInfo"

type GiftMakerRootMachineErrors =
  | GiftMakerSignActorErrors
  | GiftMakerPublishingActorErrors

export const giftMakerRootMachine = setup({
  types: {
    input: {} as {
      tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
      initialToken: BaseTokenInfo | UnifiedTokenInfo
      referral: string | undefined
    },
    events: {} as
      | DepositedBalanceEvents
      | {
          type: "START_OVER"
        }
      | {
          type: "REQUEST_SIGN"
          signerCredentials: SignerCredentials
          signMessage: (
            params: WalletMessage
          ) => Promise<WalletSignatureResult | null>
        }
      | {
          type: "COMPLETE_SIGN"
          params: GiftMakerSignActorSuccess
        },
    context: {} as {
      error: null | GiftMakerRootMachineErrors
      formRef: ActorRefFrom<typeof giftMakerFormMachine>
      depositedBalanceRef: ActorRefFrom<typeof depositedBalanceMachine>
      escrowCredentials: EscrowCredentials
      referral: string | undefined
      signData: null | GiftMakerSignActorSuccess
      intentHashes: null | string[]
    },
    children: {} as {
      readyGiftRef: "readyGiftActor"
    },
  },
  actors: {
    formActor: giftMakerFormMachine,
    depositedBalanceActor: depositedBalanceMachine,
    signActor: giftMakerSignActor as unknown as PromiseActorLogic<
      GiftMakerSignActorOutput,
      GiftMakerSignActorInput
    >,
    publishingActor: giftMakerPublishingActor as unknown as PromiseActorLogic<
      GiftMakerPublishingActorOutput,
      GiftMakerPublishingActorInput
    >,
    readyGiftActor: giftMakerReadyActor as unknown as PromiseActorLogic<
      void,
      GiftMakerReadyActorInput
    >,
  },
  actions: {
    logError: (_, event: { error: unknown }) => {
      const err = toError(event.error)
      logger.error(err)
    },
    setError: assign({
      error: (
        _,
        result:
          | {
              tag: "err"
              value: GiftMakerRootMachineErrors
            }
          | { tag: "ok" }
      ) => {
        assert(result.tag === "err")
        return result.value
      },
    }),
    relayToDepositedBalanceRef: sendTo(
      "depositedBalanceRef",
      (_, event: DepositedBalanceEvents) => event
    ),
    completeSign: ({ self }, event: GiftMakerSignActorSuccess) => {
      self.send({ type: "COMPLETE_SIGN", params: event })
    },
    cleanup: assign({
      error: null,
      signData: null,
    }),
  },
  guards: {
    isOk: (_, params: { tag: "ok" | "err" }) => params.tag === "ok",
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAYgBkB5AcQEkA5AbQAYBdRUABwHtZcAXXF3zsQAD0QBaAEwBGAGwA6ACxKmsgJwBmdXIAcezVIA0IAJ6T1AVgUB2dUt1T9mpXaV6Avh5NoseQqSUVBQAqgAqzGxIINy8AkIi4ggyllIKTDqWckxysjI2esZmFtZujs6u9p7eIL44BMQKkPwEUCQASgCiAIohnQDKYQD6-TRUjKwisS0J0UkSMjKaCjqaukoyuvqpKuom5ghSTDIKlpo2KkqaMuq6lse6Xj4Y9QEKvFD4rSQQQmAKBAAblwANb-D74dpgABmkSmPBmwjmiDkiicunUTCUqRcjhk+0QUksNgUuhsUg2MixlhuGSetRe-kaEO+v0IAPwwLB71wnyhsJkUU4CPiSNASU0NIUVPsUk0ciU6gK8qUBMOxNJ5KURwxUisTE09LqTKIPM+3zAACdLVxLQoOAAbdB8aG21BmyEwuHRaaixKSbRMdIaJZnGw07RqwzqaVMJg2bQFC4uSxGxkNU0s-BtADCFAAsgAFMidMKdEZjCZCmIiwRisSSGRHU7rLTy9EGhVq1yKSwOOTqG5SGxMSxaNN+DMeyA-P4crn-S1gdAQUxUXDQvj873CuJ1-0IbQnewydxrAdZPWq4oIMckkdN8MXFI5CevZm8wgQEhWm12x3Oq6lrukuK5rhuW5epMPq1rM4qSKoihUjYZJrOS6hSFIchqsSSi2BSeg5Fc5woV4NT4FwEBwCIxoZvCe5wQ2CASNieHIahZJ6ph2E3i40pymoeRMBi2IUm+JpNBALTZvRiIHhIuhBnYlj6FYtz2OcRQHE2Jy5Joaj9kskpiTUtFvFmUCyX6yLMSkyxYXcVxkohay6FGqinGc+iLEcNx9qmpnpuZn6QFZ+42QsdwKO2w6aHFKlnFkOHkrYxxOE2+nkksZEeEAA */
  context: ({ input, spawn }) => ({
    error: null,
    formRef: spawn("formActor", {
      input: {
        initialToken: input.initialToken,
      },
    }),
    depositedBalanceRef: spawn("depositedBalanceActor", {
      id: "depositedBalanceRef",
      input: {
        tokenList: input.tokenList,
      },
    }),
    escrowCredentials: generateEscrowCredentials(),
    referral: input.referral,
    signData: null,
    intentHashes: null,
  }),

  initial: "editing",

  on: {
    LOGIN: {
      actions: {
        type: "relayToDepositedBalanceRef",
        params: ({ event }) => event,
      },
    },
    LOGOUT: {
      actions: {
        type: "relayToDepositedBalanceRef",
        params: ({ event }) => event,
      },
    },
  },
  states: {
    editing: {
      on: {
        REQUEST_SIGN: {
          target: "signing",
        },
      },
    },
    signing: {
      entry: [],

      on: {
        COMPLETE_SIGN: {
          target: "publishing",
        },
      },

      invoke: {
        id: "signRef",
        src: "signActor",

        input: ({ context, event }) => {
          assertEvent(event, "REQUEST_SIGN")

          const form = context.formRef.getSnapshot()
          const parsed = form.context.parsedValues.getSnapshot()

          return {
            signerCredentials: event.signerCredentials,
            signMessage: event.signMessage,
            parsed: parsed.context as {
              [K in keyof typeof parsed.context]: NonNullable<
                (typeof parsed.context)[K]
              >
            },
            balances:
              context.depositedBalanceRef.getSnapshot().context.balances,
            referral: context.referral,
            escrowCredentials: context.escrowCredentials,
          }
        },

        onError: {
          target: "editing",
          actions: [
            {
              type: "logError",
              params: ({ event }) => event,
            },
            {
              type: "setError",
              params: { tag: "err", value: { reason: "EXCEPTION" } },
            },
          ],
        },

        onDone: [
          {
            guard: { type: "isOk", params: ({ event }) => event.output },
            actions: {
              type: "completeSign",
              params: ({ event }) => {
                assert(event.output.tag === "ok")
                return event.output.value
              },
            },
          },
          {
            target: "editing",
            actions: {
              type: "setError",
              params: ({ event }) => event.output,
            },
          },
        ],
      },
    },
    publishing: {
      entry: assign({
        signData: ({ event }) => {
          assertEvent(event, "COMPLETE_SIGN")
          return event.params
        },
      }),
      invoke: {
        src: "publishingActor",
        input: ({ context }) => {
          const multiPayload = context.signData?.multiPayload
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
            target: "signed",
          },
          {
            target: "editing",
            actions: {
              type: "setError",
              params: { tag: "err", value: { reason: "ERR_GIFT_PUBLISHING" } },
            },
          },
        ],
        onError: {
          target: "editing",
          actions: [
            {
              type: "logError",
              params: { error: "EXCEPTION" },
            },
          ],
        },
      },
    },
    signed: {
      invoke: {
        id: "readyGiftRef",
        src: "readyGiftActor",
        input: ({ context }) => {
          const signData = context.signData
          assert(signData, "signData is not defined")

          const form = context.formRef.getSnapshot()
          const parsedValuesSnapshot = form.context.parsedValues.getSnapshot()

          const parsedValues = parsedValuesSnapshot.context
          assert(
            parsedValues.token !== null && parsedValues.amount !== null,
            "token and amount are not defined"
          )

          const parsed = parseMultiPayloadTransferMessage(signData.multiPayload)
          assert(parsed !== null, "Invalid parsed multiPayload")

          const tokenDiff = getTokenDiffFromTransferMessage(parsed)
          assert(tokenDiff !== null, "Invalid token diff")

          const giftInfo: GiftInfo = {
            tokenDiff,
            token: parsedValues.token,
            secretKey: context.escrowCredentials.secretKey,
            accountId: context.escrowCredentials.credential,
            message: parsedValues.message,
          }

          return {
            giftId: signData.giftId,
            giftInfo,
            signerCredentials: signData.signerCredentials,
            escrowCredentials: context.escrowCredentials,
            parsed: {
              token: parsedValues.token,
              amount: parsedValues.amount,
              message: parsedValues.message,
            },
          }
        },

        onDone: {
          target: "editing",
        },

        onError: {
          target: "editing",
          actions: {
            type: "logError",
            params: ({ event }) => event,
          },
        },
      },
    },
  },
})
