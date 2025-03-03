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
      referral: string | undefined
    },
  },
  actors: {
    formActor: giftFormMachine,
    depositedBalanceActor: depositedBalanceMachine,
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
        // parentRef: self,
        tokenList: input.tokenList,
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
      id: "signRef",
      src: "signActor",

      input: ({
        context,
        event,
      }: {
        context: {
          formRef: ActorRefFrom<typeof giftFormMachine>
          depositedBalanceRef: ActorRefFrom<typeof depositedBalanceMachine>
          referral: string | undefined
        }
        event: {
          type: "REQUEST_SIGN"
          signerCredentials: SignerCredentials
          signMessage: (
            params: WalletMessage
          ) => Promise<WalletSignatureResult | null>
        }
      }) => {
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
          balances: context.depositedBalanceRef.getSnapshot().context.balances,
          referral: context.referral,
        }
      },
    },
  },
})
