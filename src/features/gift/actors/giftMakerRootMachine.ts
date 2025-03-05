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
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import type { WalletMessage, WalletSignatureResult } from "../../../types/swap"
import { assert } from "../../../utils/assert"
import { toError } from "../../../utils/errors"
import {
  type Events as DepositedBalanceEvents,
  depositedBalanceMachine,
} from "../../machines/depositedBalanceMachine"
import { giftMakerEscrowActor } from "./giftMakerEscrowActor"
import { giftMakerFormMachine } from "./giftMakerFormMachine"
import {
  type GiftMakerReadyActorInput,
  giftMakerReadyActor,
} from "./giftMakerReadyActor"
import type {
  GiftMakerSignActorErrors,
  GiftMakerSignActorInput,
  GiftMakerSignActorOutput,
} from "./giftMakerSignActor"
import { giftMakerSignActor } from "./giftMakerSignActor"

export const giftMakerRootMachine = setup({
  types: {
    input: {} as {
      tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
      initialTokenIn: BaseTokenInfo | UnifiedTokenInfo
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
          multiPayload: MultiPayload
          signerCredentials: SignerCredentials
          usedNonceBase64: string
          giftId: string
          signatureResult: WalletSignatureResult
        },
    context: {} as {
      error: null | GiftMakerSignActorErrors
      formRef: ActorRefFrom<typeof giftMakerFormMachine>
      depositedBalanceRef: ActorRefFrom<typeof depositedBalanceMachine>
      escrowRef: ActorRefFrom<typeof giftMakerEscrowActor>
      referral: string | undefined
    },
    children: {} as {
      readyGiftRef: "readyGiftActor"
    },
  },
  actors: {
    formActor: giftMakerFormMachine,
    depositedBalanceActor: depositedBalanceMachine,
    escrowActor: giftMakerEscrowActor,
    signActor: giftMakerSignActor as unknown as PromiseActorLogic<
      GiftMakerSignActorOutput,
      GiftMakerSignActorInput
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
        result: { tag: "err"; value: GiftMakerSignActorErrors } | { tag: "ok" }
      ) => {
        assert(result.tag === "err")
        return result.value
      },
    }),
    relayToDepositedBalanceRef: sendTo(
      "depositedBalanceRef",
      (_, event: DepositedBalanceEvents) => event
    ),
    completeSign: (
      { self },
      event: {
        multiPayload: MultiPayload
        signerCredentials: SignerCredentials
        signatureResult: WalletSignatureResult
        usedNonceBase64: string
        giftId: string
      }
    ) => {
      self.send({ type: "COMPLETE_SIGN", ...event })
    },
  },
  guards: {
    isOk: (_, params: { tag: "ok" | "err" }) => params.tag === "ok",
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAYgBkB5AcQEkA5AbQAYBdRUABwHtZcAXXF3zsQAD0QAmAHQSJADgCsANgDsAZgAsTAIwKNcuRIA0IAJ6JtSuVKZylTDQrWy5GjWoC+Hk2ix5CpJRUFACqACrMbEgg3LwCQiLiCBIqSlLaatpMCgYKWWpKEhom5giW1rb2js7ybp7eIL44BMRSkPwEUCRUAKJ0PQBKAIJhPQD6PQDKAMIDFADqkSKxHQnRSdqpUmq2TBIAnCo5hZYliI7aNtpZbo67KfU+GM0BbRAd+F0DPQCKIVNhMaTGhURisZY8VbCdYWNRSOTOJhqFT7BQqbRyFSyBRnBAKBwyQwaJRZZSbRReBr4LgQOAiJr+YgQuKCaGgJIAWnUUg0WKUej27hUDiUuMyl0U+w0+20qLkcoKXiefhaRDeHygzKhiXOKjF+322wUUuNriYKn0FIaDNVUl4UHwnS18TZYkQHIkCh5fIFRWRDmUuONXsMB1sUuyFvqXiAA */
  context: ({ input, spawn }) => ({
    error: null,
    formRef: spawn("formActor", {
      input: {
        initialTokenIn: input.initialTokenIn,
      },
    }),
    depositedBalanceRef: spawn("depositedBalanceActor", {
      id: "depositedBalanceRef",
      input: {
        tokenList: input.tokenList,
      },
    }),
    escrowRef: spawn("escrowActor", {
      id: "escrowRef",
      input: {
        type: "ed25519",
      },
    }),
    referral: input.referral,
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
      on: {
        COMPLETE_SIGN: "signed",
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
            escrowKeyPair: context.escrowRef.getSnapshot().context.keyPair,
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
                return {
                  ...event.output.value,
                  giftId: `gift-${event.output.value.usedNonceBase64}`,
                }
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
    signed: {
      invoke: {
        id: "readyGiftRef",
        src: "readyGiftActor",

        input: ({ context, event }) => {
          assertEvent(event, "COMPLETE_SIGN")

          const form = context.formRef.getSnapshot()
          const formValuesSnapshot = form.context.formValues.getSnapshot()
          const parsedValuesSnapshot = form.context.parsedValues.getSnapshot()

          const formValues = formValuesSnapshot.context as {
            [K in keyof typeof formValuesSnapshot.context]: NonNullable<
              (typeof formValuesSnapshot.context)[K]
            >
          }

          const parsedValues = parsedValuesSnapshot.context as {
            [K in keyof typeof parsedValuesSnapshot.context]: NonNullable<
              (typeof parsedValuesSnapshot.context)[K]
            >
          }

          return {
            parsed: parsedValues,
            raw: formValues,
            usedNonceBase64: event.usedNonceBase64,
            multiPayload: event.multiPayload,
            giftId: event.giftId,
            signerCredentials: event.signerCredentials,
            signatureResult: event.signatureResult,
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
