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
import { giftEscrowMachine } from "./giftEscrowMachine"
import { giftFormMachine } from "./giftFormMachine"
import type {
  GiftSignActorErrors,
  GiftSignActorInput,
  GiftSignActorOutput,
} from "./giftSignActor"
import { giftSignMachine } from "./giftSignActor"

export const giftRootMachine = setup({
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
        },
    context: {} as {
      error: null | GiftSignActorErrors
      formRef: ActorRefFrom<typeof giftFormMachine>
      depositedBalanceRef: ActorRefFrom<typeof depositedBalanceMachine>
      escrowRef: ActorRefFrom<typeof giftEscrowMachine>
      referral: string | undefined
    },
  },
  actors: {
    formActor: giftFormMachine,
    depositedBalanceActor: depositedBalanceMachine,
    escrowActor: giftEscrowMachine,
    signActor: giftSignMachine as unknown as PromiseActorLogic<
      GiftSignActorOutput,
      GiftSignActorInput
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
        result: { tag: "err"; value: GiftSignActorErrors } | { tag: "ok" }
      ) => {
        assert(result.tag === "err")
        return result.value
      },
    }),
    relayToDepositedBalanceRef: sendTo(
      "depositedBalanceRef",
      (_, event: DepositedBalanceEvents) => event
    ),
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
      },
    },
  },
})
