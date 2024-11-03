import { parseUnits } from "ethers"
import type { providers } from "near-api-js"
import {
  type ActorRefFrom,
  assertEvent,
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

    clearWithdrawalSpec: assign({
      withdrawalSpec: null,
    }),
    updateWithdrawalSpec: assign({
      withdrawalSpec: ({ context }) => {
        const balances =
          context.depositedBalanceRef.getSnapshot().context.balances
        const formValues = context.withdrawFormRef.getSnapshot().context

        return getRequiredSwapAmount(
          formValues.tokenIn,
          formValues.tokenOut,
          formValues.parsedAmount,
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
    isQuoteRelevant: ({ context }) => {
      if (context.withdrawalSpec == null) return false
      if (context.withdrawalSpec.swapParams == null) return true

      return context.quote != null && context.quote.totalAmountOut > 0n
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

    isCoreInputData: (_, event: WithdrawFormParentEvents) => {
      const v =
        event.fields.includes("parsedAmount") ||
        event.fields.includes("tokenIn") ||
        event.fields.includes("tokenOut")

      return v
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QHcCWAXAFhATgQ2QFoBXVAYgEkA5AFQFFaB9AZTppoBk6ARAbQAYAuolAAHAPawMqcQDsRIAB6JCAVlUA2AHQBGAEwBmVXp0GAHBtX8LAGhABPFQHYAnHt0aX-VQBZVZpw0fHzMAX1C7NCxcAhJyDgB5AHFqAWEkEAkpdBl5DOUESy0XHz0S1R0fDXMnYLtHBEJXAy0nPX5DIx1+UqDwyIxsfCJSMkSkhIBVGjSFLOk5BQLCEx8taxL+Sy2DDQ765xcWto6DLp69PoiQKKHY0i1IaVkoMgg5MC1YdDx0T9uYiNUI8IM8oLMMvMcot8og-O5+DpAmUXGY9GY3IYDo0dP5Wn5qkYnPwthonP0boNAXEQWCyAB1Cg0AAS3AASgBBemMABiCTZAFktAAqCFiSQLPKgZYaMxrMxmVROfylHwklwabGEAylLQaPYlLy1XZ6VQUgHDGlPHIvMgAIQ5HA5VAAwnRGC7mc6kjwxZkJdCpUoVKb+FofAZ9Ls0Rp0fw2lqde59fxDfGI7GzdcLfdgdbULaHU7Xe7Pd7fTp0uLsrklipce4MYYepZZU5AlrcS1usZ2n4SXt4+aqZaHvnbYyWeyubz+QLeRQ6BxuMwPV6qD6+EI5gHa7DGmTtOiXDokcr2mcnJ29lo9FVIz5umZ47jydmR7naTaoFpUBAADZgGQsDEAARgAthgfpQnu0oqBqqitOomjVPoLj+KoWp6G0WgWBYqg1NYCrDtEo55qC36-gBQFUHQ3IAIqTAk9DQbuMJwTilSIeqOguMqXF8XoWpuMUd4hM+GI6GifgkXcQJfgWP6iDgYCiHg+CBm8HxfD8fxaDm8njkpKlqRpuSsTW7HBo0JQtOU+onoepg6FhYZmAY6IEaaZKSUcsnUmOFGKVoymqepvy5PpeBgowoF4P+eCyAAxkBRbOm6a7lluVb+pZQYyth6whEipQKhoSKYQ4iBGIhJXGDqThSUiOr+WRCkvCFJnhYGUUxXFCXJUBFmSnWjSKohlyGFJnn+Ki2JEuG2GnlJj6uMErWfkZnVhWZchUYBWmyJ83y-P8H6GUFHWhaZEV7X+gHDYGo2EKi6xnGYp7+N00ZXlVCBGNoZIVKtbTmO5G0XWC203T193HcgeCiIwACOxDiHpcNkLRDFMSx26Qmx+UqKVb1bD46G1E4GJ1H9gRrKoGrBBU5iPiEENWpdxk7bdsj7fDiMo2jGPUWQj2wdZhBM29SpyimMbYsSLitAqPS+OVUk9OzDwgRBGDfodnwFgAbuIADW-OiGyYAAGZi1ZBT6k4xSEeh1SNWYWETe5bRTYiXgGG+AykZ+OuQeg+tgDgODiDgIUJeg1sx+BXwI5bNt20ThR8Vo6jObiMsJn9n24WU7bk3epwB1rwKh3rilY3RjCMcxdAZ6NnjuLiar6MDpgGImEbhiU6J094JJ6OE1yyOIEBwAoBlxDueXPfoj7rKmvH8X4glauVYa7IiZK7PegTV+1UBLyN+6EKeRzryefHAwzhcNJLgS3vGrjqOi+o6BoZ9bThpfJ618FRKxJPxDEJ4DDWCEn9G+g9LAMwfGiOUj4sxBzkhzKG11urixgvbesh9cL+AsMqHUUlsSvW8FYYIqY1Ton0AAzm0M8F7QRn1eKiUUrAPFssWoYZeLRjASSAILk-qeXDFUS4VQgiBAHMwnBXVdq8yAQTZe18NRmBIWVchj4PZ-TVErPuFMPq9COIHSkwdIaUVwSovmKcBao3RmAXhhCDyGHDOVdsFgTyIgqNicq2jCSU3cmcVE-93zWOwbY5RPMHGwFToLFxWhnF-EYCpPAEAGjVivhxFYqZcKnnocDdC1gfAK28MUFCgR1CthKIo2J3NYbUUcUjNJhtqJuMzmoZUXizy+O6LicRDRiROwvP2GBIQyiNOCnY+JcMdIxzwDARgs8oTJL+N056bg3KkKBhQgxDRyprGwsgo4kZeKGFmVdOJLTAJLPwKs9ZAZNmfHeEdbZoCcKKl0QRfRlSdA51RHhbwGYDA3K5jDSK8zAxrI+F8-JwytAeSamI1W6hfoNHRGsXi6EYEnhOB5SFWgPmuPUXkiWfjwxU1cF2Ho3QsUqCTOsdQfgKg7GfEYM+tdw6KURdZaogM-4RiTFYQ+nZ3LFCOH7Mh7RKiT1CEAA */
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

        WITHDRAW_FORM_FIELDS_CHANGED: {
          target: ".preparation",
          guard: {
            type: "isCoreInputData",
            params: ({ event }) => event,
          },
        },
      },

      states: {
        idle: {
          on: {
            submit: {
              target: "done",
              guard: "isQuoteRelevant",
              actions: [
                "clearIntentCreationResult",
                { type: "setSubmitDeps", params: ({ event }) => event.params },
              ],
            },

            NEW_QUOTE: {
              actions: ["updateUIAmountOut"],
            },
          },
        },

        preparation: {
          initial: "waiting_balance",

          states: {
            waiting_balance: {
              on: {
                BALANCE_CHANGED: "idle",
              },

              always: {
                target: "idle",
                guard: "isBalanceReady",
              },
            },

            idle: {
              type: "parallel",

              states: {
                swap_quote: {
                  initial: "idle",
                  states: {
                    quote_ready: {
                      type: "final",
                    },

                    idle: {
                      on: {
                        NEW_QUOTE: {
                          target: "quote_ready",

                          actions: {
                            type: "setQuote",
                            params: ({ event }) => event.params.quote,
                          },

                          reenter: true,
                        },
                      },

                      always: {
                        target: "quote_ready",
                        guard: "isSwapNotNeeded",
                        reenter: true,
                      },
                    },
                  },
                },

                storage_deposit_quote: {
                  states: {
                    done: {
                      type: "final",
                    },
                  },

                  initial: "done",
                },
              },

              entry: [
                () => {
                  console.log("prep")
                },
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

          onDone: {
            target: "idle",
            actions: "updateUIAmountOut",
          },

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

        input: ({ context, self }) => {
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
  directWithdrawalAmount: bigint
  tokenOut: BaseTokenInfo
}

function getRequiredSwapAmount(
  tokenIn: UnifiedTokenInfo | BaseTokenInfo,
  tokenOut: BaseTokenInfo,
  totalAmountIn: bigint,
  balances: Record<BaseTokenInfo["defuseAssetId"], bigint>
): WithdrawalSpec | null {
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
