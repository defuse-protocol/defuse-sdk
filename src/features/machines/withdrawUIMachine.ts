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
  /** @xstate-layout N4IgpgJg5mDOIC5QHcCWAXAFhATgQ2QFoBXVAYgEkA5AFQFFaB9AZTppoBk6ARAbQAYAuolAAHAPawMqcQDsRIAB6JCAVlUAWAHQAOAOwA2AEwBOEwf4BGfUYA0IAJ4q9ey1oN71rjZaMBmHT8jAF9g+zQsXAIScg4AeQBxagFhJBAJKXQZeTTlBA8tSxMrAwMTP0t+Iw0reycEQhc-LSMjD1V+Pz9VSwMNHVDwjGx8IlIyeIS4gFUaFIUM6TkFPMIjX10NdZ0NPXW9vz665z1m1vbO7t7+wZAIkejSLUhpWSgyCDkwLVh0PHRvvcomNUM8IK8oPM0ossstcogNF0tHoTKo9p5+qpAh5jg1rM0zJZdusfHodJY9LcgaMYmCIWQAOoUGgACW4ACUAIIMxgAMTi7IAsloAFRQsSSJY5UCrDTmdx+Ew6KxmAJFU64wiHPRaXa7Pz8YpBSxU4bA2kvLJvMgAIU5HE5VAAwnRGE6WY6EjxxelJbDpUoVESzp0TJYOvp+GVypqAvwtFG-BoykYdIFwyEwnczTSnpbUNa7Q7na73Z7vZZUhLMtkVoh-AmzKoDX1+DoTIY2prrG4An0Anpkx2iQZTZFc6D89amayOdy+QLBXyKHQONxmG6PVQvXwhAs-bX4Q0Om5NFUkwFDmjAt2jKpdcYijpVBZPM-M0Nx49J+Cre8qHQPIAIrTHE9A+jCh4ykGUYmFohz8D0YZyjoqYGJqphwVibbNr0BiWBSGgaGODwgnSf5aKgEAADZgGQsDEAARgAthgEEHnC0ENGSRgJuoNT8FYRj8P0GixhsabkgY+jFESYaUlm1LfuRBZQFoog4GAoh4Pg-ofF8Px-ACWhKWRU5qRpWk6f82TsTWnGBtxd7uK45TSWSLgGKomryh4vjlFU5JFCaik5sp5nqZp2m6dkkVgIwYCKGAADGxD+owmkAI6kJpzFgLI6CwPpsjfL8-yAmFZm-qpcXRTZchxQlSWpelWU5WAeUFbAdlSnWx6Dsicq7JoqqpmJjiIARBqFARIlBaopghZ+pEWtVby1dZ-qNYlKVpdkGVgNlqC5flhXFaVRkVV+VUQhtMUNZZTW7a1h3tZ1hW8JW+72QGqxdDqbZJlYBE1B0431FN8YEZU-QEQtYYkeaeZrRZUWbbFj07S1+1tcdHWnUVnwlYZ5UmZVq23ZZdVbZjzV7XIB1HSdXW8EYVa+j9fVat0CY7Kc3iIjJuK+Dzg7qLN-Q6MYiMTip61U+jD2aU92MM7jzOFVojF4NReCyMlgJ4BCjAAGbiDgjDa7r+t0UWjoupu5a7uzkEOaspjNLsZRYgEGgvsYuI7PeZT8Ci6x+Ci54y+FKN3fVsjbXTL1M-jXVazresG5RNF0T1-pc37OpEa0ftGqmPS4sY2jJqmrTtqcocDKF10UxRCv3QntPPTjr14+9sDp9bWdUbRZCfS7HG-SoRieLzirPnolwiZYldlLq+h+yJirFIh0c3W3aMd4n3dq73GsDyVohEpYjC-ObeAwJbGc21oEBgACOCsbIqmM29BPnZRWQAA3cQABrK6K1kaU0PvHY+qtZC-z7gTLQl9r633QPfR+VtM7fDfh-L+P91ap0KggAsIDkrxxSHnKCjlCA7G0OqFwYN0QolxHse8Q0KQEVcFYcke9W41XbrArG9MEFEP7gAsqxlTICPljAraIjk5-xZnuaEk8+rhh1B2LwTZ2xS0HMLEuWgeiCRMB7YMqh+FQIPlZI+iie4pwkUTC6pMZHWMEfI2K9jT6OIJuPb6vUjxEmrkOVw6xDSKm6MLaGhRDQGAqGSRUPg-BWJ-NA2xwik4OOUWdZxJNpHk3cXIjJCisk+Jyd1NmAT85BPlFLNMwlGHWDJMLQSBhdCHHJOYHYlRDSpLlqjEpXiyliLPsQgesBkB4FEIwbK4hjIjzogBYCoFwKqOrIEriaxBLGK8pvEcYYLB2AmggXoipdCoTKN0JoSp+kRSEaUk+ozfFp0mdM2ZxB5nfEWWPdZHNNm0P2MYxeHhi57DMZoYWpw4JpiKC+FEFI7x3Njg84ZTzEHn3UuIPAlscBUUfgWM2WhqLYvBNaPJZCwEQKRmkmx1M0XwIxeMrFOLGJ4ugPFQl4hiWktUqQ4B4gKH+ioX812U9+rtIjjPIIpRESeD0FCwI8EXzKmJFiDoH5swtyKYM+lDVvHPIqSy3F+LOWyCJSSvAZL3hgBwDgc26ldboDNp-Mm2raUeKGfqkZTL+7GrZaaxgXKeVWr5ZSoVtkhDULdioNE95F6aF6G5VMiphbSV4mYcwi9ByKmbKOZukCPXFMIKiuQvyJ6cyPGsPoCZBzPlRIJWC1RcT+HaaHRufQKShyuci9JJbPFlv8WoytWzdhuDMZc6SRJ1gUhbYcWtodXDxMEuGNM-SGIsQwH+ABlLwE-CmaIdkYATbRvFRYe85QRpdrlGY9CJy6FuCjPDI08LTBN2WjSn4TFWLoG3RSgVe63mHuPUOjZNSuJYjgpYIIbZEIvkNL4QO8bSiBAWiiLYqIUkFs-Run927bX2pwI6-4LrmL7umUek9or1FHj6O0kFHZ0SVHxMLEw1dVBKl6Fx1EG913fq3apMgyzGAgTAnQU9fVl2FA6GSLY4Z+jNvvZ0waVhSQdnWJmLMshxBv3gGkNxqBqk0NWNDHUCEkJyVQlLTUxh7zVCCD4cJE6FIftluZIzMa8RRnadUKwhoOx+3PZqZM95DS7D0VsUw57e0UUWR58VjRoMJnDNJQ4l6ujdlcFoco3hGPaP4jFz1eqAxiq5sxnQLQaiVDMGLILJyKi8TkiHMOhclpasLQMuONNlYGt9QTeLXMOzxl89VgL8HvInJ8BVwSaXhJdACFiQrxTitwNEX1tO2CbYDarR0DhkXS6dHLivE5u3stpfKBSLElR33tc-fcgdnces+vEcgzbWcpnGxdU-IeYBttbNTDqZd6hvMIrvGwskhQ2N+2Emxwc1Qlu6sVo9+KvWXsbeflnZxf3AU9EKKhQKLZigceOfUC7uhpIqjMeiP2COusYye+itHms3vfJztj92phkSVFsxqkSIXcQcbOBx-RexoPPksdhtzKKHuraUUgtOqCfDoMwfFFn7OVBmN4iN-ztXEIC8QvBNoj5OjJmMJqgznXS3I5VmtpnF8tJoLvvgLBGPcHv1tQQt463Crq4aBvSrfmauBb1ydsx7g5TA86IL-QtOrey+yfLzWiub5O4fqr13r8vi+8aMUXQiF6nkn6NvQO5zoM8IC4iJMLnbtS-SSt1HYz+7Z4nevMMhplRJmKCTyaBooOISKHeVC-MbsW-u16hODeXmayAx8r52e2j3jRFGQcWxwV3nBpNOU8YlTJiaIX72seZeT6NTPuZxksfDoBSZ-QZ2ihhkCFLUzwtyTxhcHeVoa-2yH-H88Z7jfkGn6fILJs6X7ga0J4QPiJiohhxITCzXjwShwdBticbSTf715-5T4DwSCsrsoErmriDZ59BwSyYKYdBKjxLd6nJb6G5sb6BSwLTGBYauYxx15I6-6M7-5pzYEmocpBr4EhrWqEFWDIj0KoRkFSxBBwEuDuALQ+CtjahoFsHH6J5YHYo8F4FEoX5gbGaxpJaaDzxESOYP7P5yi6DXhEHpoeyKF2IYFGrJ7K7O7xRn6-agE6F+7Kit7VYd5b6UFEhpgtAmLQZ4TIHWGZIcGYEoIO5K6p6PzOGZ4lTZ6BC8T9Bt5Kgm5d5SGL7QpyYeBXjESS4sF0psFW6MBaH-JgF5CzS6jdA+xmLzyuC4jby6h7D4TlAGhSzDS05lGlZVqnDVyRjDQthdAb4NARw6guAUgWBcI2Df79rj7z65476wRhZF4jEwocaCQNJohHKDh8abq-qqS+5ojaD4QwY9BtBXAYSGgtABAbznhhgOahChBAA */
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
