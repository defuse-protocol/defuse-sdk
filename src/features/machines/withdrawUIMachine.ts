import type { providers } from "near-api-js"
import {
  type ActorRefFrom,
  and,
  assign,
  emit,
  fromPromise,
  not,
  sendTo,
  setup,
  spawnChild,
} from "xstate"
import { settings } from "../../config/settings"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../types/base"
import type { Transaction } from "../../types/deposit"
import { isBaseToken } from "../../utils"
import {
  type Events as BackgroundQuoterEvents,
  type ParentEvents as BackgroundQuoterParentEvents,
  backgroundQuoterMachine,
} from "./backgroundQuoterMachine"
import {
  type BalanceMapping,
  type Events as DepositedBalanceEvents,
  depositedBalanceMachine,
} from "./depositedBalanceMachine"
import { intentStatusMachine } from "./intentStatusMachine"
import {
  type Output as NEP141StorageOutput,
  nep141StorageActor,
} from "./nep141StorageActor"
import type { AggregatedQuote } from "./queryQuoteMachine"
import {
  type Output as SwapIntentMachineOutput,
  swapIntentMachine,
} from "./swapIntentMachine"
import {
  type Events as WithdrawFormEvents,
  type ParentEvents as WithdrawFormParentEvents,
  withdrawFormReducer,
} from "./withdrawFormReducer"

export type Context = {
  error: Error | null
  quote: AggregatedQuote | null
  intentCreationResult: SwapIntentMachineOutput | null
  intentRefs: ActorRefFrom<typeof intentStatusMachine>[]
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
  withdrawalSpec: WithdrawalSpec | null
  depositedBalanceRef: ActorRefFrom<typeof depositedBalanceMachine>
  withdrawFormRef: ActorRefFrom<typeof withdrawFormReducer>
  submitDeps: {
    userAddress: string
    nearClient: providers.Provider
    sendNearTransaction: (tx: Transaction) => Promise<{ txHash: string } | null>
  } | null
  nep141StorageOutput: NEP141StorageOutput | null
  nep141StorageQuote: AggregatedQuote | null
  preparationOutcome: null | { tag: "ok" } | { tag: "err"; value: string }
}

type PassthroughEvent = {
  type: "INTENT_SETTLED"
  data: {
    intentHash: string
    txHash: string
    tokenIn: BaseTokenInfo | UnifiedTokenInfo
    /**
     * This is not true, because tokenOut should be `BaseTokenInfo`.
     * It left `BaseTokenInfo | UnifiedTokenInfo` for compatibility with `intentStatusActor`.
     */
    tokenOut: BaseTokenInfo | UnifiedTokenInfo
    quote: AggregatedQuote
  }
}

export const withdrawUIMachine = setup({
  types: {
    input: {} as {
      tokenIn: BaseTokenInfo | UnifiedTokenInfo
      tokenOut: BaseTokenInfo
      tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
    },
    context: {} as Context,
    events: {} as
      | {
          type: "submit"
          params: NonNullable<Context["submitDeps"]>
        }
      | {
          type: "BALANCE_CHANGED"
          params: {
            changedBalanceMapping: BalanceMapping
          }
        }
      | BackgroundQuoterParentEvents
      | DepositedBalanceEvents
      | WithdrawFormEvents
      | WithdrawFormParentEvents
      | PassthroughEvent,

    emitted: {} as PassthroughEvent,

    children: {} as {
      depositedBalanceRef: "depositedBalanceActor"
      swapRef: "swapActor"
      withdrawFormRef: "withdrawFormActor"
    },
  },
  actors: {
    backgroundQuoterActor: backgroundQuoterMachine,
    depositedBalanceActor: depositedBalanceMachine,
    formValidationActor: fromPromise(async (): Promise<boolean> => {
      throw new Error("not implemented")
    }),
    swapActor: swapIntentMachine,
    intentStatusActor: intentStatusMachine,
    withdrawFormActor: withdrawFormReducer,
    nep141StorageActor: nep141StorageActor,
  },
  actions: {
    updateUIAmountOut: () => {
      throw new Error("not implemented")
    },
    setQuote: assign({
      quote: (_, value: AggregatedQuote) => value,
    }),
    clearQuote: assign({ quote: null }),
    clearError: assign({ error: null }),
    setIntentCreationResult: assign({
      intentCreationResult: (_, value: SwapIntentMachineOutput) => value,
    }),
    clearIntentCreationResult: assign({ intentCreationResult: null }),
    passthroughEvent: emit((_, event: PassthroughEvent) => event),

    setSubmitDeps: assign({
      submitDeps: (_, value: Context["submitDeps"]) => value,
    }),
    setNEP141StorageOutput: assign({
      nep141StorageOutput: (_, result: Context["nep141StorageOutput"]) =>
        result,
    }),
    clearNEP141StorageOutput: assign({
      nep141StorageOutput: null,
    }),
    setPreparationOutcome: assign({
      preparationOutcome: (_, val: Context["preparationOutcome"]) => val,
    }),
    clearPreparationOutcome: assign({
      preparationOutcome: null,
    }),

    clearWithdrawalSpec: assign({
      withdrawalSpec: null,
    }),
    updateWithdrawalSpec: assign({
      withdrawalSpec: ({ context }) => {
        const balances =
          context.depositedBalanceRef.getSnapshot().context.balances
        const formValues = context.withdrawFormRef.getSnapshot().context

        if (formValues.parsedAmount == null) {
          return null
        }

        if (context.nep141StorageOutput == null) {
          return null
        }
        let nep141StorageBalanceNeeded = 0n
        switch (context.nep141StorageOutput.result) {
          case "OK":
            nep141StorageBalanceNeeded = 0n
            break
          case "NEED_NEP141_STORAGE":
            nep141StorageBalanceNeeded = context.nep141StorageOutput.amount
            break
          default:
            return null
        }

        return getWithdrawalSpec(
          formValues.tokenIn,
          formValues.tokenOut,
          formValues.parsedAmount,
          nep141StorageBalanceNeeded,
          balances
        )
      },
    }),

    spawnBackgroundQuoterRef: spawnChild("backgroundQuoterActor", {
      id: "backgroundQuoterRef",
      input: ({ self }) => ({
        parentRef: self,
        delayMs: settings.quotePollingIntervalMs,
      }),
    }),
    sendToBackgroundQuoterRefNewQuoteInput: sendTo(
      "backgroundQuoterRef",
      ({ context }): BackgroundQuoterEvents => {
        const withdrawalSpec = context.withdrawalSpec

        if (withdrawalSpec == null || withdrawalSpec.swapParams == null) {
          return { type: "PAUSE" }
        }

        return {
          type: "NEW_QUOTE_INPUT",
          params: withdrawalSpec.swapParams,
        }
      }
    ),
    // Warning: This cannot be properly typed, so you can send an incorrect event
    sendToBackgroundQuoterRefPause: sendTo("backgroundQuoterRef", {
      type: "PAUSE",
    }),

    relayToDepositedBalanceRef: sendTo(
      "depositedBalanceRef",
      (_, event: DepositedBalanceEvents) => event
    ),
    sendToDepositedBalanceRefRefresh: sendTo("depositedBalanceRef", (_) => ({
      type: "REQUEST_BALANCE_REFRESH",
    })),

    // Warning: This cannot be properly typed, so you can send an incorrect event
    sendToSwapRefNewQuote: sendTo(
      "swapRef",
      (_, event: BackgroundQuoterParentEvents) => event
    ),

    spawnIntentStatusActor: assign({
      intentRefs: (
        { context, spawn, self },
        output: SwapIntentMachineOutput
      ) => {
        if (output.status !== "INTENT_PUBLISHED") return context.intentRefs

        // todo: take quote from result of `swap`
        const quote =
          context.quote != null
            ? context.quote
            : {
                quoteHashes: [],
                expirationTime: 0,
                totalAmountIn: 0n,
                totalAmountOut: 0n,
                amountsIn: {},
                amountsOut: {},
              }

        const formValues = context.withdrawFormRef.getSnapshot().context

        const intentRef = spawn("intentStatusActor", {
          id: `intent-${output.intentHash}`,
          input: {
            parentRef: self,
            intentHash: output.intentHash,
            tokenIn: formValues.tokenIn,
            tokenOut: formValues.tokenOut,
            quote: quote,
          },
        })

        return [intentRef, ...context.intentRefs]
      },
    }),

    relayToWithdrawFormRef: sendTo(
      "withdrawFormRef",
      (_, event: WithdrawFormEvents) => event
    ),
  },
  guards: {
    satisfiesWithdrawalSpec: ({ context }) => {
      if (context.withdrawalSpec == null) return false

      let isValid = true

      const swapRequired = context.withdrawalSpec.swapParams != null
      if (swapRequired) {
        isValid =
          isValid && context.quote != null && context.quote.totalAmountOut > 0n
      }

      const nep141StorageRequired =
        context.withdrawalSpec.nep141StorageAcquireParams != null
      if (nep141StorageRequired) {
        isValid = isValid && context.nep141StorageQuote != null
      }

      return isValid
    },
    isSwapNotNeeded: ({ context }) => {
      assert(context.withdrawalSpec != null, "withdrawalSpec is null")
      return context.withdrawalSpec.swapParams == null
    },
    isTrue: (_, value: boolean) => value,
    isFalse: (_, value: boolean) => !value,
    isBalanceReady: ({ context }) => {
      const snapshot = context.depositedBalanceRef.getSnapshot()
      return Object.keys(snapshot.context.balances).length > 0
    },

    isBalanceSufficientForQuote: (
      _,
      {
        balances,
        quote,
      }: { balances: BalanceMapping; quote: AggregatedQuote | null }
    ) => {
      // No quote - no need to check balances
      if (quote == null) return true

      for (const [token, amount] of Object.entries(quote.amountsIn)) {
        // We need to know balances of all tokens involved in the swap
        const balance = balances[token]
        if (balance == null || balance < amount) {
          return false
        }
      }

      return true
    },

    isBalanceSufficientForAmountIn: ({ context }) => {
      const formContext = context.withdrawFormRef.getSnapshot().context
      assert(formContext.parsedAmount != null, "parsedAmount is null")

      const balances =
        context.depositedBalanceRef.getSnapshot().context.balances

      const underlyingTokensIn = isBaseToken(formContext.tokenIn)
        ? [formContext.tokenIn]
        : formContext.tokenIn.groupedTokens

      let totalBalance = 0n
      for (const token of underlyingTokensIn) {
        const balance = balances[token.defuseAssetId]
        if (balance != null) {
          totalBalance += balance
        }
      }

      return formContext.parsedAmount <= totalBalance
    },

    isNEP141StorageFetched: ({ context }) => {
      return (
        context.nep141StorageOutput != null &&
        (context.nep141StorageOutput.result === "OK" ||
          context.nep141StorageOutput.result === "NEED_NEP141_STORAGE")
      )
    },

    isWithdrawParamsComplete: ({ context }) => {
      const formContext = context.withdrawFormRef.getSnapshot().context
      return (
        formContext.parsedAmount != null && formContext.parsedRecipient != null
      )
    },

    isPreparationOk: ({ context }) => {
      return context.preparationOutcome?.tag === "ok"
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QHcCWAXAFhATgQ2QFoBXVAYgEkA5AFQFFaB9AZTppoBk6ARAbQAYAuolAAHAPawMqcQDsRIAB6JCAVlUAWAHQAOAOwA2AEwBOEwf4BGfUYA0IAJ4q9ey1oN71rjZaMBmHT8jAF9g+zQsXAIScg4AeQBxagFhJBAJKXQZeTTlBA8tSxMrAwMTP0t+Iw0reycEQhc-LSMjD1V+Pz9VSwMNHVDwjGx8IlIyeIS4gFUaFIUM6TkFPMIjX10NdZ0NPXW9vz665z1m1vbO7t7+wZAIkejSLUhpWSgyCDkwLVh0PHRvvcomNUM8IK8oPM0ossstcogNF0tHoTKo9p5+qpAh5jg1rM0zJZdusfHodJY9LcgaMYmCIWQAOoUGgACW4ACUAIIMxgAMTi7IAsloAFRQsSSJY5UCrDTmdx+Ew6KxmAJFU64wiHPRaXa7Pz8YpBSxU4bA2kvLJvMgAIU5HE5VAAwnRGE6WY6EjxxelJbDpUoVESzp0TJYOvp+GVypqAvwtFG-BoykYdIFwyEwnczTSnpbUNa7Q7na73Z7vZZUhLMtkVoh-AmzKoDX1+DoTIY2prrG4An0Anpkx2iQZTZFc6D89amayOdy+QLBXyKHQONxmG6PVQvXwhAs-bX4Q05dpw6pjOH255uhpu+StH2NE-26pzKdKVnqY9J+CrVAtKgEAADZgGQsDEAARgAthgPowoeMrODoRgJuoNT8FYRj8P0t6OCoFQoWm5IGPoxREmGH5DOO350n+AHAaBVB0DyACK0xxPQcEHnCiENMUOiFMSnR7HKyq4fUhDhs0g4GJYFQGFi6oeGODwgrRBb-qIOBgKIeD4P6HxfD8fwAloX5qVOmnabp+nZFxNY8YGDR7Ko7iuOUJFki4CmavKHi+OUVTkkUJqfjmNGWVoWk6Xp-zZFF2mMGAihgAAxsQ-qMNpACOpDaVBYCyOgsCGbI3y-P8gLhRZv4aQlMW2XI9VJSl6WZTleVgAVRWwPZUp1g0aKubJYaaGmhzWOJiCVGShTGD0JTPtYKnmnmtVvPVNlxU10UtWlGXZFlYC5ag+WFcVpXlSZVXUTVEKbbF-rNcl+3tcdnXdcVvCVvuDkBqsbSuYayE7EY6gdEquIzQJvRg5U1z9MtYW3Ra61WQ122yM9rUHXIR0nWdPWXcZlVmdVqP3dFW1PbtL1tYdHWnV1529UYVa+n9A1aq+upJk+-jktUr5Q74zQGtY-ARu2WGUdmKNrZT1mPfFtM429BPMz1WgQXgQF4LIqWAngEKMAAZuIOCMDresG6BRaOi6m7lru7PwY5AMmNoSalH43lpuefi4ii0lbGDPiRuUoVUapFN0VTys7YldO47I+MfSz2u6-rhv0SBZB9f6XMaFiD6WEUYOpp4njhriaIoT0Ww7J7fRKqoK0TupG3x41WOq69DPvUzn2wJnNs54Beffa73H-SoRieFoqKHApbaeJ7dh4fkFJaM27a+P0xRhpm0erT+isYzTSdqwPGvD1oZWiESliML8Ft4DAVtZ7bWgQGAAI4DBWQGk05DxZsTAsAA3cQABrG6McFZxyVj3bG-c8aM0JsVe+Okn4v3QG-D+1ts7fF-v-QBwD0Ga2KggSB4hUqYxSAXBCTlCA7CBh4YuT4Kjnh0LiDwzRNAByCFhLC7Z24RTRg9ZByd1bpyJp8MqJNTLmVjnVbumNnjXzQYPDBvU9zQhngNXwAk0Sh38L7KMyEN71DLqcXmFRKhmFDm3ZG8Cz6IIvvFaRN9ZGYNgMgPAohGC5XEKZCejFmKMDYhxOgjD3b4R2MiDsmh+CDkMEUYuUMG6L12J5bC6hujOJPh3SKainpeK0bfDOfiAlBOICE74YT856OrP1I8hAahuGVG0TwgRDjnkllDZM8Y5ImErocQImExF3XcYQUp2QmnT05m0ooJhdAKUCM2GoOwvK8LcL0cwEyy5VE0BoKZKiu7aVmUgzG+cfr6KWbxLUeh4zKi6EEYwfZzAGF2XNA54tKhh1OS40+PxIIwXQH+cBsgoGwJ+P40Q7IwCm1ibPfIktF43kFivdhmoOg71MGiPopRiitDOU8cC0EMCQrADgHAFsop63QObABcKAmIuRc0jmrTeIGG6DvfobYgivlaDXTexQd6BFGSkvhZdNBktBBS8FkKmKsXYpxTlbtUW8uGR0MkWxwz9GqLGEiyIOmkg7OsTMWZZDiF-vANIyjSC-W5cwsu4ZCiGjJOULEOgOiqFxWYFouxJbnj2DoPoUc5auM7lAZ1hdllRh1A4r13R-YDM3u0hSjZg36AUm0Eifh5UxtzmAONTDViuGaFYbhhxvVdG7K4DF3gOwok8GhItJTrnxpad211KoPUdnbKm316brF8oCJixEvhXBIyKeI8+1MVZX1QanChw8y1xL4o25NQ6fV+txMvVColUw9FBmiDtEi5mJzAHtemFSfEj0IbbDdqK1BRlLuXVQlchqivqMXAk41gouB7ECud0zVFdqXTe8pq7tGUMfV-HO-iTbMs-mPUt9yXUAzTDvDC-gMJfuEZoIObQg2vifoicoFQL0LoTr3Zdd7YOVK1k+nO8iMM9vLXPL9qEKTSrDEUb5m9SKL3SeSDsRKv00fcYu69t6U4gJ0aPIhJaX1c3wxKzo2E0y8qTHsWuPgP1BBbZLTs0mIMeLkzBxT8GsGPx8Lg-BN7WMca5b21Yozmg7u9Wm-1m9-0PhcJHJ8X7fagajSCztln6PQc0Uxh9dmcGv3wAQxDxC-40rIW8Gz67MPuZUPoVy3nh37s3sk5EVhMJth6KYcLjq3EWdkzF+TMjQFawfklvBKXnNpZ-l8NTbSURuHaGNFZAUTBB30IUf2rhg5frlcC4pl7INNWs2ulmA3HlhnjCeNEqJ9DhvWCLdsuhFQ9BbMRNM5mLnRY0SunLVT4W1PqZt5hWJ4ytHDWUcNARi5WOmuMxevrKhPjbP4Xl130ZNbu4xh7WtqmBOCaZdjr3Vi9AMDvILvrPJkjbDwzeRJzwPhSWGHYvKyjYUh5I9Ra24N3wR890JDFUcqGbChT7xKfusP+wgQnOo0IpnWOkjsVOr1Y1p8xzBHWHPJffjepHrnNVc0O7qT2e2sRkgvFDX2bhRkyyjKSM7ouVvi7i3DqX2CZddbl4z4h-W8tcYaOSbQu2UQa8O5YQZPMhbhiMb0Lhxvbti8YCjh3m6HE7wUsUf95gOydAPbsfFWy5LKhDcmKnofOObsaEmXUkZdjNkTEmWMLhkSzYsBSawexA9XOiyzvEPHgrKg6GYlvsZhmpmLuYLo1hZLHwix3RVVKNL15Me4OSWEau8p6JqLCqyBb6BqP4MMQQgWhCAA */
  id: "withdraw-ui",

  context: ({ input, spawn, self }) => ({
    error: null,
    quote: null,
    intentCreationResult: null,
    intentRefs: [],
    tokenList: input.tokenList,
    withdrawalSpec: null,
    depositedBalanceRef: spawn("depositedBalanceActor", {
      id: "depositedBalanceRef",
      input: {
        parentRef: self,
        tokenList: input.tokenList,
      },
    }),
    withdrawFormRef: spawn("withdrawFormActor", {
      id: "withdrawFormRef",
      input: { parentRef: self, tokenIn: input.tokenIn },
    }),
    submitDeps: null,
    nep141StorageOutput: null,
    nep141StorageQuote: null,
    preparationOutcome: null,
  }),

  entry: ["spawnBackgroundQuoterRef"],

  on: {
    INTENT_SETTLED: {
      actions: [
        {
          type: "passthroughEvent",
          params: ({ event }) => event,
        },
        "sendToDepositedBalanceRefRefresh",
      ],
    },

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
      initial: "idle",

      on: {
        "WITHDRAW_FORM.*": {
          target: "editing",
          actions: [
            "clearError",
            {
              type: "relayToWithdrawFormRef",
              params: ({ event }) => event,
            },
          ],
        },

        BALANCE_CHANGED: [
          {
            guard: {
              type: "isBalanceSufficientForQuote",
              params: ({ context }) => {
                return {
                  balances:
                    context.depositedBalanceRef.getSnapshot().context.balances,
                  quote: context.quote,
                }
              },
            },
            actions: [
              "updateWithdrawalSpec",
              "sendToBackgroundQuoterRefNewQuoteInput",
            ],
          },
          ".pre-preparation",
        ],

        WITHDRAW_FORM_FIELDS_CHANGED: ".pre-preparation",
      },

      states: {
        idle: {
          on: {
            submit: {
              target: "done",
              guard: and(["satisfiesWithdrawalSpec", "isPreparationOk"]),
              actions: [
                "clearIntentCreationResult",
                { type: "setSubmitDeps", params: ({ event }) => event.params },
              ],
            },

            NEW_QUOTE: {
              actions: {
                type: "setQuote",
                params: ({ event }) => event.params.quote,
              },
            },
          },
        },

        preparation: {
          initial: "pre_execution_requirements",

          states: {
            pre_execution_requirements: {
              type: "parallel",

              states: {
                balance: {
                  initial: "idle",
                  states: {
                    waiting_for_balance: {
                      on: {
                        BALANCE_CHANGED: {
                          target: "done",
                        },
                      },
                    },

                    done: {
                      type: "final",
                    },

                    idle: {
                      always: [
                        {
                          target: "done",
                          guard: "isBalanceReady",
                        },
                        {
                          target: "waiting_for_balance",
                          actions: "sendToDepositedBalanceRefRefresh",
                        },
                      ],
                    },
                  },
                },

                nep141_storage_balance: {
                  initial: "determining_requirements",
                  states: {
                    determining_requirements: {
                      invoke: {
                        src: "nep141StorageActor",

                        input: ({ context }) => {
                          const formContext =
                            context.withdrawFormRef.getSnapshot().context

                          assert(
                            formContext.parsedRecipient != null,
                            "parsedRecipient is null"
                          )

                          return {
                            token: formContext.tokenOut,
                            userAccountId: formContext.parsedRecipient,
                          }
                        },

                        onDone: {
                          target: "done",

                          actions: {
                            type: "setNEP141StorageOutput",
                            params: ({ event }) => event.output,
                          },
                        },
                      },

                      entry: "clearNEP141StorageOutput",
                    },

                    done: {
                      type: "final",
                    },
                  },
                },
              },

              onDone: [
                {
                  target: "preparation_done",
                  guard: not("isNEP141StorageFetched"),
                  actions: {
                    type: "setPreparationOutcome",
                    params: { tag: "err", value: "ERR_NEP141_STORAGE" },
                  },
                },
                {
                  target: "preparation_done",
                  guard: not("isBalanceSufficientForAmountIn"),
                  actions: {
                    type: "setPreparationOutcome",
                    params: { tag: "err", value: "ERR_BALANCE_INSUFFICIENT" },
                  },
                },
                {
                  target: "execution_requirements",
                },
              ],
            },

            execution_requirements: {
              type: "parallel",

              states: {
                swap_quote: {
                  initial: "idle",
                  states: {
                    done: {
                      type: "final",
                    },

                    idle: {
                      on: {
                        NEW_QUOTE: {
                          target: "done",

                          actions: {
                            type: "setQuote",
                            params: ({ event }) => event.params.quote,
                          },
                        },
                      },

                      always: {
                        target: "done",
                        guard: "isSwapNotNeeded",
                        reenter: true,
                      },
                    },
                  },
                },

                nep141_storage_quote: {
                  states: {
                    done: {
                      type: "final",
                    },
                  },

                  initial: "done",
                },
              },

              entry: [
                "updateWithdrawalSpec",
                "sendToBackgroundQuoterRefNewQuoteInput",
              ],

              onDone: {
                target: "preparation_done",
                actions: {
                  type: "setPreparationOutcome",
                  params: { tag: "ok" },
                },
              },
            },

            preparation_done: {
              type: "final",
            },
          },

          onDone: "idle",

          entry: [
            "clearWithdrawalSpec",
            "clearQuote",
            "sendToBackgroundQuoterRefPause",
            "clearPreparationOutcome",
          ],
        },

        done: {
          type: "final",
        },

        "pre-preparation": {
          always: [
            {
              target: "preparation",
              guard: "isWithdrawParamsComplete",
            },
            "idle",
          ],
        },
      },

      onDone: {
        target: "submitting",
      },
    },

    submitting: {
      invoke: {
        id: "swapRef",
        src: "swapActor",

        input: ({ context }) => {
          assert(context.submitDeps, "submitDeps is null")
          assert(context.withdrawalSpec, "withdrawalSpec is null")

          const quote = context.quote
          if (context.withdrawalSpec.swapParams) {
            assert(quote, "quote is null")
          }

          const recipient =
            context.withdrawFormRef.getSnapshot().context.parsedRecipient
          assert(recipient, "recipient is null")

          return {
            userAddress: context.submitDeps.userAddress,
            nearClient: context.submitDeps.nearClient,
            sendNearTransaction: context.submitDeps.sendNearTransaction,
            intentOperationParams: {
              type: "withdraw",
              quote,
              directWithdrawalAmount:
                context.withdrawalSpec.directWithdrawalAmount,
              tokenOut: context.withdrawalSpec.tokenOut,
              recipient: recipient,
            },
          }
        },

        onDone: {
          target: "editing",

          actions: [
            {
              type: "spawnIntentStatusActor",
              params: ({ event }) => event.output,
            },
            {
              type: "setIntentCreationResult",
              params: ({ event }) => event.output,
            },
          ],
        },

        onError: {
          target: "editing",

          actions: ({ event }) => {
            console.error(event.error)
          },
        },
      },

      on: {
        NEW_QUOTE: {
          actions: [
            {
              type: "setQuote",
              params: ({ event }) => event.params.quote,
            },
            {
              type: "sendToSwapRefNewQuote",
              params: ({ event }) => event,
            },
          ],
        },
      },
    },
  },

  initial: "editing",
})

function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg)
  }
}

interface WithdrawalSpec {
  swapParams: null | {
    tokensIn: BaseTokenInfo[]
    tokenOut: BaseTokenInfo
    amountIn: bigint
    balances: Record<BaseTokenInfo["defuseAssetId"], bigint>
  }
  nep141StorageAcquireParams: null | {
    tokenIn: BaseTokenInfo
    tokenOut: BaseTokenInfo
    exactAmountOut: bigint
  }
  directWithdrawalAmount: bigint
  tokenOut: BaseTokenInfo
}

const STORAGE_BALANCE_TOKEN: BaseTokenInfo = {
  defuseAssetId: "nep141:wrap.near",
  address: "wrap.near",
  decimals: 24,
  icon: "https://assets.coingecko.com/coins/images/10365/standard/near.jpg",
  chainId: "mainnet",
  chainIcon: "/static/icons/network/near.svg",
  chainName: "near",
  routes: [],
  symbol: "NEAR",
  name: "Near",
}

function getWithdrawalSpec(
  tokenIn: UnifiedTokenInfo | BaseTokenInfo,
  tokenOut: BaseTokenInfo,
  totalAmountIn: bigint,
  nep141StorageBalanceNeeded: bigint,
  balances: Record<BaseTokenInfo["defuseAssetId"], bigint>
): null | WithdrawalSpec {
  const requiredSwap = getRequiredSwapAmount(
    tokenIn,
    tokenOut,
    totalAmountIn,
    balances
  )

  if (!requiredSwap) return null

  return {
    swapParams: requiredSwap.swapParams,
    nep141StorageAcquireParams:
      nep141StorageBalanceNeeded === 0n
        ? null
        : {
            // We sell output token to tiny bit of wNEAR to cover storage
            tokenIn: tokenOut,
            tokenOut: STORAGE_BALANCE_TOKEN,
            exactAmountOut: nep141StorageBalanceNeeded,
          },
    directWithdrawalAmount: requiredSwap.directWithdrawalAmount,
    tokenOut: tokenOut,
  }
}

function getRequiredSwapAmount(
  tokenIn: UnifiedTokenInfo | BaseTokenInfo,
  tokenOut: BaseTokenInfo,
  totalAmountIn: bigint,
  balances: Record<BaseTokenInfo["defuseAssetId"], bigint>
) {
  const underlyingTokensIn = isBaseToken(tokenIn)
    ? [tokenIn]
    : tokenIn.groupedTokens

  /**
   * It is crucial to know balances of involved tokens, otherwise we can't
   * make informed decisions.
   */
  if (
    underlyingTokensIn.some((t) => balances[t.defuseAssetId] == null) ||
    balances[tokenOut.defuseAssetId] == null
  ) {
    return null
  }

  /**
   * We want to swap only tokens that are not `tokenOut`.
   *
   * For example, user wants to swap USDC to USDC@Solana, we will quote for:
   * - USDC@Near → USDC@Solana
   * - USDC@Base → USDC@Solana
   * - USDC@Ethereum → USDC@Solana
   * We skip from quote:
   * - USDC@Solana → USDC@Solana
   */
  const tokensIn = underlyingTokensIn.filter(
    (t) => tokenOut.defuseAssetId !== t.defuseAssetId
  )

  /**
   * Some portion of the `tokenOut` balance is already available and doesn’t
   * require swapping.
   *
   * For example, in a swap USDC → USDC@Solana, any existing USDC@Solana
   * balance is directly counted towards the total output, reducing the amount
   * we need to quote for.
   */
  let swapAmount = totalAmountIn
  if (underlyingTokensIn.length !== tokensIn.length) {
    const tokenOutBalance = balances[tokenOut.defuseAssetId]
    // Help Typescript
    assert(tokenOutBalance != null, "Token out balance is missing")
    swapAmount -= min(tokenOutBalance, swapAmount)
  }

  return {
    swapParams:
      swapAmount > 0n
        ? { tokensIn, tokenOut, amountIn: swapAmount, balances }
        : null,
    directWithdrawalAmount: totalAmountIn - swapAmount,
    tokenOut,
  }
}

function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}
