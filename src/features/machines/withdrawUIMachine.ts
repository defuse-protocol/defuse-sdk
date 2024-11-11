import type { providers } from "near-api-js"
import {
  type ActorRefFrom,
  and,
  assign,
  emit,
  not,
  sendTo,
  setup,
  spawnChild,
} from "xstate"
import { settings } from "../../config/settings"
import {
  type AggregatedQuote,
  isAggregatedQuoteEmpty,
} from "../../services/quoteService"
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
import {
  getPOABridgeInfo,
  poaBridgeInfoActor,
  waitPOABridgeInfoActor,
} from "./poaBridgeInfoActor"
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
  poaBridgeInfoRef: ActorRefFrom<typeof poaBridgeInfoActor>
  submitDeps: {
    userAddress: string
    nearClient: providers.Provider
    sendNearTransaction: (tx: Transaction) => Promise<{ txHash: string } | null>
  } | null
  nep141StorageOutput: NEP141StorageOutput | null
  nep141StorageQuote: AggregatedQuote | null
  preparationOutput:
    | null
    | { tag: "ok" }
    | {
        tag: "err"
        value:
          | "ERR_BALANCE_INSUFFICIENT"
          | "ERR_NEP141_STORAGE"
          | "ERR_CANNOT_FETCH_POA_BRIDGE_INFO"
          | "ERR_AMOUNT_TOO_LOW"
      }
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
  }
}

type EmittedEvents = PassthroughEvent | { type: "INTENT_PUBLISHED" }

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

    emitted: {} as EmittedEvents,

    children: {} as {
      depositedBalanceRef: "depositedBalanceActor"
      swapRef: "swapActor"
      withdrawFormRef: "withdrawFormActor"
    },
  },
  actors: {
    backgroundQuoterActor: backgroundQuoterMachine,
    depositedBalanceActor: depositedBalanceMachine,
    swapActor: swapIntentMachine,
    intentStatusActor: intentStatusMachine,
    withdrawFormActor: withdrawFormReducer,
    nep141StorageActor: nep141StorageActor,
    poaBridgeInfoActor: poaBridgeInfoActor,
    waitPOABridgeInfoActor: waitPOABridgeInfoActor,
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
    setPreparationOutput: assign({
      preparationOutput: (_, val: Context["preparationOutput"]) => val,
    }),
    clearPreparationOutput: assign({
      preparationOutput: null,
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

        if (
          context.nep141StorageOutput == null ||
          context.nep141StorageOutput.tag === "err"
        ) {
          return null
        }

        return getWithdrawalSpec(
          formValues.tokenIn,
          formValues.tokenOut,
          formValues.parsedAmount,
          context.nep141StorageOutput.value,
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
        if (output.tag !== "ok") return context.intentRefs

        const formValues = context.withdrawFormRef.getSnapshot().context

        const intentRef = spawn("intentStatusActor", {
          id: `intent-${output.value.intentHash}`,
          input: {
            parentRef: self,
            intentHash: output.value.intentHash,
            tokenIn: formValues.tokenIn,
            tokenOut: formValues.tokenOut,
            intentDescription: output.value.intentDescription,
          },
        })

        return [intentRef, ...context.intentRefs]
      },
    }),

    relayToWithdrawFormRef: sendTo(
      "withdrawFormRef",
      (_, event: WithdrawFormEvents) => event
    ),

    emitEventIntentPublished: emit(() => ({
      type: "INTENT_PUBLISHED" as const,
    })),

    fetchPOABridgeInfo: sendTo("poaBridgeInfoRef", { type: "FETCH" }),
  },
  guards: {
    satisfiesWithdrawalSpec: ({ context }) => {
      if (context.withdrawalSpec == null) return false

      let isValid = true

      const swapRequired = context.withdrawalSpec.swapParams != null
      if (swapRequired) {
        isValid =
          isValid &&
          context.quote != null &&
          !isAggregatedQuoteEmpty(context.quote)
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

    isBelowMinWithdrawal: ({ context }) => {
      const formContext = context.withdrawFormRef.getSnapshot().context
      const poaBridgeInfo = getPOABridgeInfo(
        context.poaBridgeInfoRef.getSnapshot(),
        formContext.tokenOut
      )
      assert(poaBridgeInfo != null, "poaBridgeInfo is null")
      const minAmount = poaBridgeInfo.minWithdrawal

      const withdrawalSpec = context.withdrawalSpec
      assert(withdrawalSpec != null, "withdrawalSpec is null")

      const totalAmountOut = calcTotalAmountOut(
        context.quote,
        withdrawalSpec.directWithdrawalAmount
      )

      return totalAmountOut < minAmount
    },

    isNEP141StorageFetched: ({ context }) => {
      return context.nep141StorageOutput?.tag === "ok"
    },

    isWithdrawParamsComplete: ({ context }) => {
      const formContext = context.withdrawFormRef.getSnapshot().context
      return (
        formContext.parsedAmount != null && formContext.parsedRecipient != null
      )
    },

    isPreparationOk: ({ context }) => {
      return context.preparationOutput?.tag === "ok"
    },
    isPreparationOutputSet: ({ context }) => {
      return context.preparationOutput != null
    },

    isQuoteNotEmpty: (_, quote: AggregatedQuote) =>
      !isAggregatedQuoteEmpty(quote),

    isOk: (_, a: { tag: "err" | "ok" }) => a.tag === "ok",
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QHcCWAXAFhATgQ2QFoBXVAYgEkA5AFQFFaB9AZTppoBk6ARAbQAYAuolAAHAPawMqcQDsRIAB6JCAVlUAWAHQAOAOwA2AEwBOEwf4BGfUYA0IAJ4q9ey1oN71rjZaMBmHT8jAF9g+zQsXAIScg4AeQBxagFhJBAJKXQZeTTlBA8tSxMrAwMTP0t+Iw0reycEQhc-LSMjD1V+Pz9VSwMNHVDwjGx8IlIyeIS4gFUaFIUM6TkFPMIjX10NdZ0NPXW9vz665z1m1vbO7t7+wZAIkejSLUhpWSgyCDkwLVh0PHRvvcomNUM8IK8oPM0ossstcogNF0tHoTKo9p5+qpAh5jg1rM0zJZdusfHodJY9LcgaMYmCIWQAOoUGgACW4ACUAIIMxgAMTi7IAsloAFRQsSSJY5UCrDTmdx+Ew6KxmAJFU64wiHPRaXa7Pz8YpBSxU4bA2kvLJvMgAIU5HE5VAAwnRGE6WY6EjxxelJbDpUoVESzp0TJYOvp+GVypqAvwtFG-BoykYdIFwyEwnczTSnpbUNa7Q7na73Z7vZZUhLMtkVoh-AmzKoDX1+DoTIY2prrG4An0Anpkx2iQZTZFc6D89amayOdy+QLBXyKHQONxmG6PVQvXwhAs-bX4Q0Om5NFUkwFDmjAt2jKpdcYijpVBZPM-M0Nx49J+Cre8qHQPIAIrTHE9A+jCh4ykGUYmFohz8D0YZyjoqYGJqphwVibbNr0BiWBSGgaGODwgnSf5aKgEAADZgGQsDEAARgAthgEEHnC0ENGSRgJuoNT8FYRj8P0GixhsabkgY+jFESYaUlm1LfuRBZQFoog4GAoh4Pg-ofF8Px-ACWhKWRU5qRpWk6f82TsTWnGBtxd7uK45TSWSLgGKomryh4vjlFU5JFCaik5sp5nqZp2m6dkkVgIwYCKGAADGxD+owmkAI6kJpzFgLI6CwPpsjfL8-yAmFZm-qpcXRTZchxQlSWpelWU5WAeUFbAdlSnWx6Dsicq7JoqqpmJjiIARBqFARIlBaopghZ+pEWtVby1dZ-qNYlKVpdkGVgNlqC5flhXFaVRkVV+VUQhtMUNZZTW7a1h3tZ1hW8JW+72QGqxdDqbZJlYBE1B0431FN8YEZU-QEQtYYkeaeZrRZUWbbFj07S1+1tcdHWnUVnwlYZ5UmZVq23ZZdVbZjzV7XIB1HSdXW8EYVa+j9fVat0CY7HsZ6CYYRK4r4-SFFGRh6FGvQiViiMTip61U+jD2aU92MM7jzOFVojF4NReCyMlgJ4BCjAAGbiDgjB6wbRt0UWjoupu5a7uzkEOaspjNLsZRYgEGgvsYuI7PeZT8Ci6x+Ci57y+FKN3fVsjbXTL1M-jXW6-rhvG5RNF0T1-pc4HOpEa0gdGqmPS4sY2jJqmrTtqcEcDKF10UxRyv3cntPPTjr14+9sBZ3budUbRZCfe7HG-Sokv3oDSpopcImWDXZS6vogciYqxSIXHN2d2j3cp33msD9rw8laIRKWIwvxW3gMA29n9taBAYAAjgrGyKpjNvQTc6lFZAADdxAAGsrorWRpTY+SdT4a1kP-QeBMtDX1vvfdAj9n62xzt8D+X8f5-y1hnQqCACxgOSknFIhcoKOUIDsbQ6oXBg3RCiXE-NdQmFJARVwVhyQHw7jVLu8Csb0yQSQoeQCyrGVMkIpWcCtpiLTgAlme5oQzz6uGHUHYvBNnbDoDw4NJrly0D0QSJhvbBlUIImBR8rIn2Uf3dOUiiYXVJnIuxwjFGxScefFxBMp7fV6keIkdchyuHWIaRU3QRbQ3FuYCoZJFQ+D8LYn8sCHGiNTs41RZ03Ek1keTLxCislKJyf4vJ3U2bBKLqE+Uhi0zCWYdYMkItBIGF0Icck5gdiVENOkxWqMym+IqRIi+pDh6wGQHgUQjBsriGMuPOiAFgKgXAuo6sISuKECKPeboEdo5FGTFeEWfQAaB00J4fCpxPCDIiiI8pZ9xkBMztM2Z8ziCLO+MsyemyObbPoesXi3QsR7FTFGU4a8JoIHDJYloRzdhpm3kEe5CdHmjOecgy+uscBUWfgWS2WhqLiDwOCa0BSKEQKgUjDJ9jqaYsQdiyZuL8XxUJeIYlpLyVQHIaA8QVD-Q0P+R7We3E2zwWjkhfwUs5Qiz2PGHoWxEK8M0OoNFmSGUNT8S8qprLoDstkESklZLVJkDADgHAVt1IG3QJbb+ZN24lOGVq5OOrmVD31QSo1nKTU8r5ZQ6hQhaGe2cBHFyVRgq+Gjv4eVUstB71UEqaGFIdgavsYQDFcg-nT05keNYfQEyDmfKiQSsFqi4n8J0iOLc+gUgjmUNJbdoF0u8WATNPjs1BI0XmnZuw3CWNQqUckWxeGVsOEWiOrgDAGisFiVuy1aU-CYqxdAf4gFUsgT8GZoh2RgHNiGsVFh7zlBGvWuUlj0IwoYW4KM8MjQvj2EqQZDEWIYHXZS-lW73m7v3d2rZdSuJYjgpYIIbZEIvkNL4EO95DDSW6JLbhphmwvpXe+s1FqrU4Btf8e1zFt2zL3QekVmijx9E6VLMoLhJaVHxCLbhuok1SV6HsreqG31rrNasxgIEwJ0EPX1GdUMOhklHZoVCxiGjdMGlYUkHZgWhCzLIcQH94BpE8agWpdDVgEX0LoTCrhQM9FMHoTUxh7zVAqNHKMqE7xNsXQrcyWnQ14lA3BVCZhDNXBM5qZMC9uFS2VFUQWS1sxOtbetZZzmxWNFAwmcM8HG3Nj8N2VwCbEUdhRJ4fi6a22uui1zSoYZ9OeamsZjsuIKi8TknsFMBoXAmFy6U11CDxEeoJgV-NHZ4zVCsIaDsgdj24h8DoBMnRXC3I8FUUczal0PM7T3NW7rJGoNwfbTrOyOj3jLtUJNnQq7QvqFt9Lfs3MUiMU1l1KtFvxWWxMz1a3c4zLNval+o8wAbaBXpoT6goweDDHeDhZJCjcMDsJALWxiKzcc+ihbrWVEoMzo9-BXxPtex6IUVCgUWzFCTXYGF5Q3CNJVJY9EgdLuJxpktsZ7WkevzHvnNHc9TDIkqOZjowkiJeVxEms4TGPB7FA8+Gx0P46auu-D3JiOdboJ8Jg7B8VkdM4aJY3ivWisDcg95GFx2gilH+omYSXkKdZpu+rNrK3M6y7vg-fAOD6f4M-haohbxaeFWVwwga6v+uDi1zz+FfRUQdE6Lz-QJu4e9yZZbmXWkMG26forh379Uc9sBasGOuhEKNJHYEMwIdFSFCOYaQciIkwKQc2L+lEu7uvPd6nwD9CYbNA88OIz-lTMwtA+sdLUttTJd2OXsLLahmU8ZRb+7qCf2fO+R7xU8YyTWH15UQx5wRYnl5qYLYtn53h5Gdqmn0epk7un8ZNxyvWi6GkuSMkXlhJG7X2mXUiEXBNyVJYqHFfD55erwfifbzj8LJLKM717aYqBJi8QL6GIzrL7GBdid7AbuALTqCSypjhgUi74tY156qMR4oGqMAcoe4uBQxKjrDWA4SLRr4iRmLNiaBoEBDPgYE-5YqH5eqGrGrcqqSEEX5PikHKjvhhhr7Fb6BeQHLJj9of5D5zaw575uq-617Dw4Fsr4E+rJ4lQe59D3gRiGBdBbApJXoQz6AnooiWK47ibk6i5f7NZMFR5-4x43xy7x7PyAEfYgEuaEBNglat7eaoiUHba6JTZYgaGMGOJyF6rW7y527xTOGqEuEAagEq67CeFeblba4Qx476aITHoA5JLBHwKm6MBn6uFiqzS6igq57+BKiuCVZmC6i1ZFBdBtjnIi6f7yJqSFFxFuGnB1yRjDQtg6GxguDIgTYWAUitIfiSEw6ZIdoyEe6mDxhKg1Dhyg6BCSbuZ7ZtioRogWCSwSEabLocZ-jK5ojaD4RgbGYzrVzXrg4IppiDjnhhhBBQ6hBAA */
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
    poaBridgeInfoRef: spawn("poaBridgeInfoActor", {
      id: "poaBridgeInfoRef",
    }),
    submitDeps: null,
    nep141StorageOutput: null,
    nep141StorageQuote: null,
    preparationOutput: null,
  }),

  entry: ["spawnBackgroundQuoterRef", "fetchPOABridgeInfo"],

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

        NEW_QUOTE: {
          guard: {
            type: "isQuoteNotEmpty",
            params: ({ event }) => event.params.quote,
          },
          actions: {
            type: "setQuote",
            params: ({ event }) => event.params.quote,
          },
        },
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
                    type: "setPreparationOutput",
                    params: { tag: "err", value: "ERR_NEP141_STORAGE" },
                  },
                },
                {
                  target: "preparation_done",
                  guard: not("isBalanceSufficientForAmountIn"),
                  actions: {
                    type: "setPreparationOutput",
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

                poa_bridge_info: {
                  initial: "loading",
                  states: {
                    loading: {
                      invoke: {
                        src: "waitPOABridgeInfoActor",
                        input: ({ context }) => ({
                          actorRef: context.poaBridgeInfoRef,
                        }),

                        onDone: {
                          target: "done",
                        },

                        onError: {
                          target: "done",
                          actions: {
                            type: "setPreparationOutput",
                            params: {
                              tag: "err",
                              value: "ERR_CANNOT_FETCH_POA_BRIDGE_INFO",
                            },
                          },
                        },
                      },
                    },

                    done: {
                      type: "final",
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

              onDone: [
                {
                  target: "preparation_done",
                  guard: "isPreparationOutputSet",
                },
                {
                  target: "preparation_done",
                  guard: "isBelowMinWithdrawal",
                  actions: {
                    type: "setPreparationOutput",
                    params: { tag: "err", value: "ERR_AMOUNT_TOO_LOW" },
                  },
                },
                {
                  target: "preparation_done",
                  actions: {
                    type: "setPreparationOutput",
                    params: { tag: "ok" },
                  },
                },
              ],
            },

            preparation_done: {
              type: "final",
            },
          },

          onDone: "idle",
        },

        done: {
          type: "final",
        },

        "pre-preparation": {
          entry: [
            "clearWithdrawalSpec",
            "clearQuote",
            "sendToBackgroundQuoterRefPause",
            "clearPreparationOutput",
            "clearNEP141StorageOutput",
          ],
          always: [
            {
              target: "preparation",
              guard: "isWithdrawParamsComplete",
            },
            {
              target: "idle",
            },
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

        onDone: [
          {
            target: "editing",
            guard: { type: "isOk", params: ({ event }) => event.output },
            actions: [
              {
                type: "spawnIntentStatusActor",
                params: ({ event }) => event.output,
              },
              {
                type: "setIntentCreationResult",
                params: ({ event }) => event.output,
              },
              "emitEventIntentPublished",
            ],
          },
          {
            target: "editing",
            actions: [
              {
                type: "setIntentCreationResult",
                params: ({ event }) => event.output,
              },
            ],
          },
        ],

        onError: {
          target: "editing",

          actions: ({ event }) => {
            console.error(event.error)
          },
        },
      },

      on: {
        NEW_QUOTE: {
          guard: {
            type: "isQuoteNotEmpty",
            params: ({ event }) => event.params.quote,
          },
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

function calcTotalAmountOut(
  swapQuote: AggregatedQuote | null,
  directWithdrawalAmount: bigint
): bigint {
  if (swapQuote == null) {
    return directWithdrawalAmount
  }

  return swapQuote.totalAmountOut + directWithdrawalAmount
}
