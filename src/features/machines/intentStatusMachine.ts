import { assign, fromPromise, setup } from "xstate"
import {
  type IntentSettlementResult,
  waitForIntentSettlement,
} from "../../services/intentService"

export const intentStatusMachine = setup({
  types: {
    input: {} as {
      intentHash: string
    },
    context: {} as {
      intentHash: string
      txHash: string | null
    },
  },
  actions: {
    logError: (_, params: { error: unknown }) => {
      console.error(params.error)
    },
    setSettlementResult: assign({
      txHash: (_, settlementResult: IntentSettlementResult) =>
        settlementResult.txHash,
    }),
  },
  actors: {
    checkIntentStatus: fromPromise(
      ({
        input,
        signal,
      }: {
        input: { intentHash: string }
        signal: AbortSignal
      }): Promise<IntentSettlementResult> =>
        waitForIntentSettlement(signal, input.intentHash)
    ),
  },
  guards: {
    isSettled: (_, settlementResult: IntentSettlementResult) =>
      settlementResult.status === "SETTLED",
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEsB2AXMGDK6CG6ArrAHQAOWEaUAxAMIASAonQNIDaADALqKhkB7WMnTIBqPiAAeiAIwAWAGwlFAJlWdVAVk5aAzLMUB2AJyKANCACecziZJbZnI88WOjADhOrFAX1+WaJg4+ESkAMYAFmDhANbUNBDiYCRoAG4CsSlBWOi4BMQkUTHxqFAI6QLhBGKoXNz1koLCouKSMghaqh4kHlpa8npeWkayqvKyljYIHrIkeuomCsYeemaq-oEYuflhRdFxCUmo2agZWanbIQURB6XlldWtdTzssrxIIM0ite2IXXNVAZOLIloMXEYpnIzPMRgZTF0PN15BsAiActc9sVDmUaGAAE74gT48gAGwIADNiQBbS7BPKhQrY+4VM5VGrieqNT7fZ5-BCqJYkTjwkGyUYmEX6KECnwkIxKLp6LSKRRKRSyLSbdFXBk3EgEon4mgAJSYABUTQBNbn8IQ-NqfDryLQqeSSjyrVRGAz9LQyvTyHpGb0jXScThBtX+NGoAQQOCSDF6sJNe18p2IAC03RI3hFa09QyMqrcMqzPS63o8QeREccHm1yd2hQoqCoZTTLV+mYQoOFplVYo1QL0yplTlUJFUCiRgZdKxdTd1LduJWoXYdEl73uUOj0oz0nFWSLMMs8vQjYwUnEUZlMJmX9NXJFghHC4Tg8B56Z7oA6JizCQQbyM4JgHh4IIqhOEZ5ookE1t4EzKkGT47IypBxugAD6aR4KSyAQJuGb-ogJimMBKrhh4pgeG48gTuB05GJ4LETEikFaI2aLNhhBqEsSxF-tIiDKnoDi6KqKIzoKsiBgGQbzCY-QKIGhagjGvhAA */
  id: "intentStatus",
  initial: "pending",
  context: ({ input }) => {
    return {
      intentHash: input.intentHash,
      txHash: null,
    }
  },
  states: {
    pending: {
      on: {
        CHECK: "checking",
      },
    },
    checking: {
      invoke: {
        src: "checkIntentStatus",
        input: ({ context }) => ({ intentHash: context.intentHash }),
        onDone: [
          {
            target: "success",
            guard: {
              type: "isSettled",
              params: ({ event }) => event.output,
            },
            actions: {
              type: "setSettlementResult",
              params: ({ event }) => event.output,
            },
          },
          {
            target: "not_valid",
            reenter: true,
          },
        ],
        onError: {
          target: "error",
          actions: {
            type: "logError",
            params: ({ event }) => event,
          },
        },
      },
    },
    success: {
      type: "final",
    },
    not_valid: {
      type: "final",
    },
    error: {
      on: {
        RETRY: "pending",
      },
    },
  },
})
