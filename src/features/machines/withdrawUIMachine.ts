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
  withdrawFormReducer,
} from "./withdrawFormReducer"

export type Context = {
  error: Error | null
  quote: AggregatedQuote | null
  initialFormValues: {
    tokenIn: BaseTokenInfo | UnifiedTokenInfo
    tokenOut: BaseTokenInfo
  }
  intentCreationResult: SwapIntentMachineOutput | null
  intentRefs: ActorRefFrom<typeof intentStatusMachine>[]
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
  withdrawalSpec: WithdrawalSpec | null
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
          params: {
            userAddress: string
            nearClient: providers.Provider
            sendNearTransaction: (
              tx: Transaction
            ) => Promise<{ txHash: string } | null>
          }
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

    setWithdrawalSpec: assign({
      withdrawalSpec: ({ self }) => {
        const snapshot = self.getSnapshot()

        const balances =
          snapshot.children.depositedBalanceRef?.getSnapshot().context.balances
        const formValues =
          snapshot.children.withdrawFormRef?.getSnapshot().context

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

    spawnDepositedBalanceRef: spawnChild("depositedBalanceActor", {
      id: "depositedBalanceRef",
      input: ({ self, context }) => ({
        parentRef: self,
        tokenList: context.tokenList,
      }),
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

        const snapshot = self.getSnapshot()

        // However knows how to access the child's state nicely, please update this
        const formRef: ActorRefFrom<typeof withdrawFormReducer> | undefined =
          snapshot.children.withdrawFormRef
        assert(formRef, "formRef is undefined")
        const formValues = formRef.getSnapshot().context

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
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SwO4EMAOBaArgSwGIBJAOQBUBRcgfQGUKyyAZCgEQG0AGAXUVAwD2sPABc8AgHZ8QAD0RYArAoAcAOgCMAdgWcALJ04BOZZoBMCgDQgAnvMO7Nq5ac6b1B07oWfDAX19WqJi4hABCAIJM4SQAwhTUMQAS0QDibFy8SCCCwmKS0nIIAMxFCk5GygBsmpqGnJUKlZVWtghYhpWmqtWG6lWuupWcRer+gejY+ARMAPIppBnSOaLiUlmFlUVOvbqmlbpFulpGmi12uoaqRW7Kt-aaRfUKYyBBk4SzKTMAqmSLWcs8mtQIUsKZ1JUNPpDOZwcoFJomsozm17Jdrn07g5Hg0Xm8QqpICsJFACLAcAAjAC2on+-CEK3y60Q6i0qlq7lMhz6Sm0KKwRUMl06HSFpmURiafgCrwmBKJYhJBDwEgwOBEdOyDKBBXkezK4PUOgUEKM4uu-Oul3UB046iKm3tQsqeLl+EJEGJpJIFAA6tQAIrfGaUTWA1a6trY1RC0qCkx1fRFfn7MrqcxNLxwkyjGX490KlVQVQANzQABs8BA0IrSRBJGBVCqSwIANaN-N4D1e0sVqs1osIZsCADGA8kGTD2ojzLaKi2pkMCl0yncVWUu2aNnk2iuCKM6nsnCUxiKruCBc9td7lertYI9YkjeH7dUne717Lt4HJKHEhbY5ApO6iZPSuQziC8gqGUwzHnaK4SoM-I2l0drKEUhq6IMaEunmbpduS1KiPej7Pv+bYdhMABKYAAGZTuBTKQQgRzqKoi6rlhWHrqypzbm0jxdIMG7rocDpHJo57vG+lI0iI95gAATopAiKaoGDljWtGqVSb7UXRDGMsCsiIAclyGgoIwNFU9ilMh+zsrs9gmrseyaLsUkEoRcn3j6-pBiGFCGTqs4HDBvSsuKejHJY-GKA4Vwig66GVPYnSeZePboF61AAI44AIIhgAQfmBsGoY8Es05MSZqKuKoCgwhKWhciYRTInFpRsaxvRDNcIzeP4MoSAIEBwNInZVYxxmgu4wwNU1dpmO1Dwda0WASga7mcIhpieJsZ54ReXaFiSU1GZG7RKAtUUtSt7X8iaC5Lg6pRmNiklHdJp3FlW5ZgOdIXMVgXiOAc4reCMMK1Hx62Lpw7FOs4y72lhhiHeMx0fkWN79rWgMQbVYKClcZguAi65Crc-I1E4tTo6YmjOO19oY7KWPecRRYEzVhTtWURxDOKhrVAi-JHDBe0mntJR2ocuGY99V449ltZ5QVRU8zNO5DE4m37vCuwQo9uiqIM3hPJsRu9UNvhAA */
  id: "swap-ui",

  context: ({ input }) => ({
    error: null,
    quote: null,
    initialFormValues: {
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut,
    },
    intentCreationResult: null,
    intentRefs: [],
    tokenList: input.tokenList,
    withdrawalSpec: null,
  }),

  entry: [
    "spawnBackgroundQuoterRef",
    "spawnDepositedBalanceRef",
    spawnChild("withdrawFormActor", {
      id: "withdrawFormRef",
      input: ({ context }) => ({
        tokenIn: context.initialFormValues.tokenIn,
      }),
    }),
  ],

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

    BALANCE_CHANGED: {
      actions: [
        ({ event }) => {
          console.log("Balance changed", event.params.changedBalanceMapping)
        },
        "setWithdrawalSpec",
        "sendToBackgroundQuoterRefNewQuoteInput",
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
      on: {
        submit: {
          target: "submitting",
          guard: "isQuoteRelevant",
          actions: "clearIntentCreationResult",
        },

        "WITHDRAW_FORM.*": {
          target: ".validating",
          actions: [
            "clearQuote",
            "updateUIAmountOut",
            "sendToBackgroundQuoterRefPause",
            "clearError",
            {
              type: "relayToWithdrawFormRef",
              params: ({ event }) => event,
            },
          ],
        },

        NEW_QUOTE: {
          actions: [
            {
              type: "setQuote",
              params: ({ event }) => event.params.quote,
            },
            "updateUIAmountOut",
          ],
        },
      },

      states: {
        idle: {},

        validating: {
          invoke: {
            src: "formValidationActor",

            onDone: [
              {
                target: "waiting_quote",
                guard: ({ event }) => event.output,
                actions: [
                  "setWithdrawalSpec",
                  "sendToBackgroundQuoterRefNewQuoteInput",
                ],
                reenter: true,
              },
              "idle",
            ],
          },
        },

        waiting_quote: {
          always: {
            target: "idle",
            guard: ({ context }) => {
              assert(context.withdrawalSpec != null, "withdrawalSpec is null")
              return context.withdrawalSpec.swapParams == null
            },
          },
          on: {
            NEW_QUOTE: {
              target: "idle",
              actions: [
                {
                  type: "setQuote",
                  params: ({ event }) => event.params.quote,
                },
                "updateUIAmountOut",
              ],
              description: `should do the same as NEW_QUOTE on "editing" iteself`,
            },
          },
        },
      },

      initial: "idle",
      entry: "updateUIAmountOut",
    },

    submitting: {
      invoke: {
        id: "swapRef",
        src: "swapActor",

        input: ({ context, event, self }) => {
          assertEvent(event, "submit")

          assert(context.withdrawalSpec, "withdrawalSpec is null")

          const quote = context.quote
          if (context.withdrawalSpec.swapParams) {
            assert(quote, "quote is null")
          }

          const snapshot = self.getSnapshot()

          const formRef: ActorRefFrom<typeof withdrawFormReducer> | undefined =
            snapshot.children.withdrawFormRef
          assert(formRef, "formRef is undefined")
          const { recipient } = formRef.getSnapshot().context

          return {
            userAddress: event.params.userAddress,
            nearClient: event.params.nearClient,
            sendNearTransaction: event.params.sendNearTransaction,
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
