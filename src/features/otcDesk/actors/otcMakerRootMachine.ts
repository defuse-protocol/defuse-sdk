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
import { otcMakerConfigLoadActor } from "./otcMakerConfigLoadActor"
import { otcMakerFormMachine } from "./otcMakerFormMachine"
import {
  type OTCMakerReadyOrderActorInput,
  otcMakerReadyOrderActor,
} from "./otcMakerReadyOrderActor"
import {
  type OTCMakerSignActorErrors,
  type OTCMakerSignActorInput,
  type OTCMakerSignActorOutput,
  otcMakerSignMachine,
} from "./otcMakerSignActor"

export const otcMakerRootMachine = setup({
  types: {
    input: {} as {
      tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
      initialTokenIn: BaseTokenInfo | UnifiedTokenInfo
      initialTokenOut: BaseTokenInfo | UnifiedTokenInfo
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
          tradeId: string
        },

    context: {} as {
      error: null | OTCMakerSignActorErrors
      formRef: ActorRefFrom<typeof otcMakerFormMachine>
      depositedBalanceRef: ActorRefFrom<typeof depositedBalanceMachine>
      otcMakerConfigLoadRef: ActorRefFrom<typeof otcMakerConfigLoadActor>
    },
    children: {} as {
      readyOrderRef: "readyOrderActor"
      otcMakerConfigLoadRef: "otcMakerConfigLoadActor"
    },
  },
  actors: {
    formActor: otcMakerFormMachine,
    depositedBalanceActor: depositedBalanceMachine,
    signActor: otcMakerSignMachine as unknown as PromiseActorLogic<
      OTCMakerSignActorOutput,
      OTCMakerSignActorInput
    >,
    readyOrderActor: otcMakerReadyOrderActor as unknown as PromiseActorLogic<
      void,
      OTCMakerReadyOrderActorInput
    >,
    otcMakerConfigLoadActor: otcMakerConfigLoadActor,
  },
  actions: {
    logError: (_, event: { error: unknown }) => {
      const err = toError(event.error)
      logger.error(err)
    },
    setError: assign({
      error: (
        _,
        result: { tag: "err"; value: OTCMakerSignActorErrors } | { tag: "ok" }
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
        usedNonceBase64: string
        tradeId: string
      }
    ) => {
      self.send({ type: "COMPLETE_SIGN", ...event })
    },
  },
  guards: {
    isOk: (_, params: { tag: "ok" | "err" }) => params.tag === "ok",
    isFormValid: ({ context }) => {
      return context.formRef.getSnapshot().context.isValid
    },
  },
}).createMachine({
  context: ({ input, spawn }) => ({
    error: null,
    formRef: spawn("formActor", {
      input: {
        initialTokenIn: input.initialTokenIn,
        initialTokenOut: input.initialTokenOut,
      },
    }),
    depositedBalanceRef: spawn("depositedBalanceActor", {
      id: "depositedBalanceRef",
      input: {
        // parentRef: self,
        tokenList: input.tokenList,
      },
    }),
    otcMakerConfigLoadRef: spawn("otcMakerConfigLoadActor", {
      id: "otcMakerConfigLoadRef",
    }),
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
          guard: "isFormValid",
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
    signed: {
      invoke: {
        id: "readyOrderRef",
        src: "readyOrderActor",

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
            tradeId: event.tradeId,
            signerCredentials: event.signerCredentials,
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
