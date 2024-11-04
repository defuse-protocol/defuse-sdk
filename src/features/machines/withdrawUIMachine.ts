import type { providers } from "near-api-js"
import {
  type ActorRefFrom,
  assign,
  emit,
  fromPromise,
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
      nep141StorageOutput: (_, result: NEP141StorageOutput) => result,
    }),
    clearNEP141StorageOutput: assign({
      nep141StorageOutput: null,
    }),

    clearWithdrawalSpec: assign({
      withdrawalSpec: null,
    }),
    updateWithdrawalSpec: assign({
      withdrawalSpec: ({ context }) => {
        const balances =
          context.depositedBalanceRef.getSnapshot().context.balances
        const formValues = context.withdrawFormRef.getSnapshot().context

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

        const withdrawalSpec = getWithdrawalSpec(
          formValues.tokenIn,
          formValues.tokenOut,
          formValues.parsedAmount,
          nep141StorageBalanceNeeded,
          balances
        )

        return withdrawalSpec
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
      // We can't proceed without a quote
      if (quote == null) return false

      for (const [token, amount] of Object.entries(quote.amountsIn)) {
        // We need to know balances of all tokens involved in the swap
        const balance = balances[token]
        if (balance == null || balance < amount) {
          return false
        }
      }

      return true
    },

    isNEP141StorageFetched: ({ context }) => {
      return (
        context.nep141StorageOutput != null &&
        (context.nep141StorageOutput.result === "OK" ||
          context.nep141StorageOutput.result === "NEED_NEP141_STORAGE")
      )
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QHcCWAXAFhATgQ2QFoBXVAYgEkA5AFQFFaB9AZTppoBk6ARAbQAYAuolAAHAPawMqcQDsRIAB6JCAVlUAWAHQAOAOwA2AEwBOEwf4BGfUYA0IAJ4q9ey1oN71rjZaMBmHT8jAF9g+zQsXAIScg4AeQBxagFhJBAJKXQZeTTlBA8tSxMrAwMTP0t+Iw0reycEQhc-LSMjD1V+Pz9VSwMNHVDwjGx8IlIyeIS4gFUaFIUM6TkFPMIjX10NdZ0NPXW9vz665z1m1vbO7t7+wZAIkejSLUhpWSgyCDkwLVh0PHRvvcomNUM8IK8oPM0ossstcogNF0tHoTKo9p5+qpAh5jg1rM0zJZdusfHodJY9LcgaMYmCIWQAOoUGgACW4ACUAIIMxgAMTi7IAsloAFRQsSSJY5UCrDTmdx+Ew6KxmAJFU64wiHPRaXa7Pz8YpBSxU4bA2kvLJvMgAIU5HE5VAAwnRGE6WY6EjxxelJbDpUoVNUTFo-Cj+OS2vwtqYNJrtbq9PrDZ11qbIjSnpbUNa7Q7na73Z7vZZUhLMtkVoh-FpDaiDX0IyZDG1NdY3AE+gEk2VvAZ0w8QXSre8mayOdy+QLBXyKHQONxmG6PVQvXwhAs-ZX4Q0NFtCl09YrKiY2+TQzo+jV+IZUc2B+as+CR1pUBAADZgMiwYgAIwAthgPowtuMrODoIaGGGFRWD0gR+PGViFHKNi9C4ZgaA+magtmbxaKIOBgKIeD4P6HxfD8fwAlo1KPDhz45lA+GEcRpHZMBW5wmBDR7Ko7iuOUBj6PohiqJq8oeL45RVOSRQmmEdxmthw6McxREkf82RqYwYCKGAADGxD+owhEAI6kIR-5gLI6CwORsjfL8-yAkpdEqXhBHqWxcjabpBlGdkJlgOZqCWdZtkcRWXGBg0qh9FoWJkp4cUeD4diOIgOiaIU-C9kYypVIaqhYW5uFMZ5rGaT5nk6XphnGWZFlgFZNl2Z8DmUc5NGuUOZVqZV-q+XVAVyEFIVha1vClpuUUBnkpzIsYhJBCYvinOl9SBEYCWqIc0kaAY1gmCECm0b1DEeSxGmDTVfn1YFjWhc14WwFov54O+eCyPpgJ4BCjAAGbiDgjDvZ931fnmjousuxbrmWvqzVWDQGvwob+L4+gRnouU6LiqhmIUgSRkYnimMVp09RaF3lVd3myEN-kNcFTUtbZb0fV9P2vh+X6RVKyOEAd2j5TsvStEmRhxXouJhjqqJYoinS7Pw-AU0MGalTT-XXVpt3Dcz43Pa1HPg9zb6fmQU0IyB0WrPlbjSZYcVVEme4yxlCAxloSrRjjaJ7OUzsledEI6-TjP3aNj0TezDmiESliML8wN4DAoOcxDWgQGAAI4IBsiMWNrMvfZ3w5gAbuIADWLma6HL4Vbr1WEbVTMPSzT1s698eJ8n6Cp+nYNc98Od5wXRcx8btkIJX4j6VVsgpPz-qCzoEHIQa+WtBUQke-U-TaMqlhEhYzsQc26uKfX1Nh03Ed3SNsjF13pftY5VF14Ot+N3Ti-PAbDuRtu4r1AjFSwBp+Jqy6OvCoh5cTJRaNYXahokyHGjCHH+ql77-0fobEuJtYDIDwKIRg5lxDUQtl+KgdAeQAEVphxHoKAu2Kg1T8SJBGC+Qlna4kxjqG8BhoKHXMBUAYlMb5Pjvn-QaeCgEEPZkQkhZDiAUPLrzK2G5oScTmmwpU-EDCaEVFlVw5I+H+G2m0FEpwTBbEVJ4TBTwfwAQwCOMur5ZBV1rj8Yhoh2RgABiw3R+Q1Y+26P0XwhjcpJk1B0BK5NDAHTKFUE6Gtv5OL-IBdAbiwA4BwMDfCn10BA3zj4kh-jAlaPLALHcQi+KaGVFtAmrReGe2KAlQIx1BGnBPpoRxoJnFZLcTQ+hjDmFVMRjU7iQi0bOxvDsdYDTqjxiEsiGoidrHrBOgpWQ4gc7wDSGdGIM0pkxUIL0kMyDDgVA6BoHocZPaED6AYWsiSPAYw8C4fp7koAnNXjuc5J83BXKEXMu5RJYknx9tUIFrgbxyn7BI9J9Ew5UL+WA1YrhmiwSEntboXQ2yuDCd4Zs1j1B9KRY+FFv8vKL3RawvEuVmggpudGe5bZtCdEliiFBYZDHfL6jgm6rc5HR07rHA51T-ncXObBImu1QW3J6AhT2FJtqVBxqtfK5gigCu1kKvWIrAFiuAS9U2I96XBLUBsUWPhjCky2HFXEUsQxbDMBBNEPglSIrSVSn54d-763biahRr1h5Z2If9EpGczZgEtYLWMiZ3l1iMNA3K+MKjuH0MSCxECeh6ukbS4VYA25R2flPbu5qs7v3jQCqWOhawO29TBA6YlPZCT4ocSo15nnvILTSgahqS2ivLeK6eYbM7m15rWmV-gXnqA8KiHQbRkHLM9n4A6yJVCizJIlMkqTr7Iv9Qaluw7jWjtNSbXuPh+6DxLeGn6M6znmB1CysFyrnXxSEd0OKYtDHyV9cpQVMih2lqfi-CVWhr1JxTvgIek7R651yRPN4EHx1PtWKtS5WVrnvogbLHoPs4rbv6I01NpN+3YJA6esD+DX5XqIn3WDad70Iezl8DDKhAjyyxL4E+uVUQ3nxs2dwasUk+DirsK+RypEDubgzEdaHu6cYaMUHUhwdi7BscdHwuIdU+0XWrEk7YD0yepVRotWlFMVrNUo0h5CAQqbUC4HKUsAiwTUyq+oJ8fCFAgUIso3qKR+Eo5dSzPlrNjsrXZlRaj2MOSc70Zo4KcOdIWaicx+VdSHAsB0OWl4fWHr9cB8LCnz1Kds742LlDp3aKRgC7dlyqi7WPgTG8XnEC+FMFmroSVLzRkK2Z491GyvBovaGqDjGb3MfTg5uNdXTmrCyiGDT7ttMwr4USTlPRVaeAjEdSklKgP6pGwAsbFWGMJ2mwPODJa5vxfm1KjFXGoWra04qHTlhzGZugtxrKaJSaHcA1rQtg7T1g+fjWhb0rwGdEKH0Zsgn-Bqbbd5lzh1EQQLQhYQx0mqaydUlDp7DLGgbt1FjKTDZ4GPLlsiVwhgrCmL2N8wZrjGIqc9e4CBqaehtCuJqVNIZ-DryTFUY8QRMKhGCEAA */
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
      entry: "updateUIAmountOut",

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
            target: "editing",
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
          ".preparation",
        ],

        WITHDRAW_FORM_FIELDS_CHANGED: ".preparation",
      },

      states: {
        idle: {
          on: {
            submit: {
              target: "done",
              guard: "satisfiesWithdrawalSpec",
              actions: [
                "clearIntentCreationResult",
                { type: "setSubmitDeps", params: ({ event }) => event.params },
              ],
            },

            NEW_QUOTE: undefined,
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
                          reenter: true,
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
                          return {
                            token: formContext.tokenOut,
                            userAccountId: formContext.recipient,
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
                  target: "execution_requirements",
                  guard: "isNEP141StorageFetched",
                },
                {
                  target: "preparation_done",
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

                          reenter: true,
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
                reenter: true,
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
          ],
        },

        done: {
          type: "final",
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

          const { recipient } = context.withdrawFormRef.getSnapshot().context

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
