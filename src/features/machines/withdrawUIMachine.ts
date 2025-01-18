import type { providers } from "near-api-js"
import {
  type ActorRefFrom,
  assign,
  emit,
  sendTo,
  setup,
  spawnChild,
} from "xstate"
import { settings } from "../../config/settings"
import { logger } from "../../logger"
import {
  type AggregatedQuote,
  isAggregatedQuoteEmpty,
} from "../../services/quoteService"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../types/base"
import type { ChainType, Transaction } from "../../types/deposit"
import { assert } from "../../utils/assert"
import { userAddressToDefuseUserId } from "../../utils/defuse"
import { isBaseToken } from "../../utils/token"
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
  poaBridgeInfoActor,
  waitPOABridgeInfoActor,
} from "./poaBridgeInfoActor"
import {
  type PreparationOutput,
  prepareWithdrawActor,
} from "./prepareWithdrawActor"
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
  intentCreationResult: SwapIntentMachineOutput | null
  intentRefs: ActorRefFrom<typeof intentStatusMachine>[]
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
  depositedBalanceRef: ActorRefFrom<typeof depositedBalanceMachine>
  withdrawFormRef: ActorRefFrom<typeof withdrawFormReducer>
  poaBridgeInfoRef: ActorRefFrom<typeof poaBridgeInfoActor>
  submitDeps: {
    userAddress: string
    userChainType: ChainType
    nearClient: providers.Provider
    sendNearTransaction: (
      tx: Transaction["NEAR"]
    ) => Promise<{ txHash: string } | null>
  } | null
  preparationOutput: PreparationOutput | null
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
      backgroundQuoterRef: "backgroundQuoterActor"
      swapRef: "swapActor"
    },
  },
  actors: {
    backgroundQuoterActor: backgroundQuoterMachine,
    depositedBalanceActor: depositedBalanceMachine,
    swapActor: swapIntentMachine,
    intentStatusActor: intentStatusMachine,
    withdrawFormActor: withdrawFormReducer,
    poaBridgeInfoActor: poaBridgeInfoActor,
    waitPOABridgeInfoActor: waitPOABridgeInfoActor,
    prepareWithdrawActor: prepareWithdrawActor,
  },
  actions: {
    logError: (_, event: { error: unknown }) => {
      logger.error(event.error)
    },

    setQuote: assign({
      preparationOutput: ({ context }, value: AggregatedQuote) => {
        if (
          context.preparationOutput == null ||
          context.preparationOutput.tag === "err" ||
          context.preparationOutput.value.swap == null
        ) {
          return context.preparationOutput
        }

        return {
          ...context.preparationOutput,
          value: {
            ...context.preparationOutput.value,
            swap: {
              ...context.preparationOutput.value.swap,
              swapQuote: value,
            },
          },
        }
      },
    }),
    updateSwapParams: assign({
      preparationOutput: (
        { context },
        { balances }: { balances: BalanceMapping }
      ) => {
        if (
          context.preparationOutput == null ||
          context.preparationOutput.tag === "err" ||
          context.preparationOutput.value.swap == null
        ) {
          return context.preparationOutput
        }

        return {
          ...context.preparationOutput,
          value: {
            ...context.preparationOutput.value,
            swap: {
              ...context.preparationOutput.value.swap,
              balances,
            },
          },
        }
      },
    }),

    setIntentCreationResult: assign({
      intentCreationResult: (_, value: SwapIntentMachineOutput) => value,
    }),
    clearIntentCreationResult: assign({ intentCreationResult: null }),

    passthroughEvent: emit((_, event: PassthroughEvent) => event),

    setSubmitDeps: assign({
      submitDeps: (_, value: Context["submitDeps"]) => value,
    }),
    setPreparationOutput: assign({
      preparationOutput: (_, val: Context["preparationOutput"]) => val,
    }),
    clearPreparationOutput: assign({
      preparationOutput: null,
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
        const preparationOutput = context.preparationOutput

        if (
          preparationOutput == null ||
          preparationOutput.tag === "err" ||
          preparationOutput.value.swap == null
        ) {
          return { type: "PAUSE" }
        }

        return {
          type: "NEW_QUOTE_INPUT",
          params: {
            ...preparationOutput.value.swap.swapParams,
            balances:
              context.depositedBalanceRef.getSnapshot().context.balances,
          },
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
    isTrue: (_, value: boolean) => value,
    isFalse: (_, value: boolean) => !value,

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

    isWithdrawParamsComplete: ({ context }) => {
      const formContext = context.withdrawFormRef.getSnapshot().context
      return (
        formContext.parsedAmount != null && formContext.parsedRecipient != null
      )
    },

    isPreparationOk: ({ context }) => {
      return context.preparationOutput?.tag === "ok"
    },

    isQuoteNotEmpty: (_, quote: AggregatedQuote) =>
      !isAggregatedQuoteEmpty(quote),

    isOk: (_, a: { tag: "err" | "ok" }) => a.tag === "ok",
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QHcCWAXAFhATgQ2QFoBXVAYgEkA5AFQFFaB9AZTppoBk6ARAbQAYAuolAAHAPawMqcQDsRIAB6JCAVlUAWAHQAOAOwA2AEwBOEwf4BGfUYA0IAJ4q9ey1oN71rjZaMBmHT8jAF9g+zQsXAIScg4AeQBxagFhJBAJKXQZeTTlBA8tSxMrAwMTP0t+Iw0reycEQhc-LSMjD1V+Pz9VSwMNHVDwjGx8IlIyeIS4gFUaFIUM6TkFPMIjX10NdZ0NPXW9vz665z1m1vbO7t7+wZAIkejSLUhpWSgyCDkwLVh0PHRvvcomNUM8IK8oPM0ossstcogNEEtJ5LAEioj2jpjg0-PwDMiTKiTHoTDodFZWrcgaMYmCIWQAOoUGgACW4ACUAIIMxgAMTi7IAsloAFRQsSSJY5UCrIwuFpbDRlEzVHQGHSabGEAL8LR4vyI3p6LZtIyqKnDYG0l5ZN5kABCnI4nKoAGE6IxXSyXQkeOL0pLYdKlCp1C0-HoNTsDJZXL4tTq9QYDWUjGSKqoQmE7paaU8bag7Y7nW6PV6fX7LKkJZlsitENVkerTFVyjYAn4tf4dIVdoq1ToiuVzdnqY9QQW7VQ6DyAIrTOL0f0wuvwhqqVxaYppirbiw+BPkpMGoydHRmMx9C2RPMT8G295M1kc7l8gWCvkUOgcbjMT3eqhfT4IQFkDVcZRUap8X4fgal8VRm0qfQtUsTN3A8EwNFUfRVEObo-GvB4QTpB8tFQCAABswDIWBiAAIwAWwwZcwLhCCGkjIw9XUGoYN8WCdgTDYyUHdUSSsDRCT0QirXze9CygLQcDgMB0EYURlIANxkYhYHU5TRDwfAgzIFjazYkMGkwrR+xcAxsLTcwDGxHQuLxCxPBg9oTBk28SIUpSVLUjSwG08RdP0sBDOM7JTKrUDzODWVPGRU4qlRPFNDaZzHEQVykxjXE2hqPZPF88d-LeLQQui-5Ys+WRvkLTTxAAa0BXMKsnRSaqMuq5AQZrxAAY362QUjMqV6waYw9F0YxYLxPR+FOVxsSKXVcVjLDI1ccSsyGG8uvkqrepiuQyDAHAcHEHBqoo-4ADNboYrQx2I7rqoMvqg0G2QWtGoMJpA6FWKSlREzNSwlREpV1CxXKEA2rQtuNDd9FjYoNHK4jaMYjAHw+L4yP+trvlgZA8FEdkwEeyag2mixVC3fDim6U81UsLsVvDSoVT4io5QMHHaTxpj0EJhqmtJ9qfkp6nad4eLQcS6bsJMQogn4cl1AsQk7ERwhJMKPiyWhk1oYOnMjtx+jxcJq6bru0QHvQZ6cFeimqZpumQZrKa1z6fFlrEg1EX8LnEdwmz1QjM8XHPFURaeMWCYUshpznBclz9gNVcDtMWlPUkOjVAITC1XY5tMYp+FwmxygI25ZHECA4AUd6YgSgP2MIfQezrzQYIpASNC1ZM5o0PtcUF4kk9HTqPpOqBu4Ztc+9xbih7409+jHw24b1TCPDxMwyUjbGF5t61l7IyiwFX8DLMaVE9VQ2OynwztDdjNxym8YkJJPA8WTneCEgVYCqUimFCKZ0xqPwsqsSw0NCiJ0CMmDc2FVDj20BJawklCS+A1NJK+REb7gLgWvf2VDn5EL1LsBCPhNDWA8HodaMZkSuWKKieypcBikNkmA0iUsEHgw4gaGy+hYKeFxMmA0CZ5QuFjBYX+NhQE-DtmnN4oi1bGhRoSHY21cKwRyvUbUSJ457BVKoFUyDQihCAA */
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
                const balances =
                  context.depositedBalanceRef.getSnapshot().context.balances

                if (
                  context.preparationOutput == null ||
                  context.preparationOutput.tag === "err" ||
                  context.preparationOutput.value.swap == null
                ) {
                  return {
                    balances,
                    quote: null,
                  }
                }

                return {
                  balances,
                  quote: context.preparationOutput.value.swap.swapQuote,
                }
              },
            },
            actions: [
              {
                type: "updateSwapParams",
                params: ({ event }) => ({
                  balances: event.params.changedBalanceMapping,
                }),
              },
              "sendToBackgroundQuoterRefNewQuoteInput",
            ],
          },
          ".reset_previous_preparation",
        ],

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

        WITHDRAW_FORM_FIELDS_CHANGED: ".reset_previous_preparation",
      },

      states: {
        idle: {
          on: {
            submit: {
              target: "done",
              guard: "isPreparationOk",
              actions: [
                "clearIntentCreationResult",
                { type: "setSubmitDeps", params: ({ event }) => event.params },
              ],
            },
          },
        },

        reset_previous_preparation: {
          always: [
            {
              target: "preparation",
              guard: "isWithdrawParamsComplete",
            },
            {
              target: "idle",
            },
          ],

          entry: ["sendToBackgroundQuoterRefPause", "clearPreparationOutput"],
        },

        preparation: {
          invoke: {
            src: "prepareWithdrawActor",
            input: ({ context, self }) => {
              const backgroundQuoteRef:
                | ActorRefFrom<typeof backgroundQuoterMachine>
                | undefined = self.getSnapshot().children.backgroundQuoterRef
              assert(backgroundQuoteRef != null, "backgroundQuoteRef is null")

              return {
                formValues: context.withdrawFormRef.getSnapshot().context,
                depositedBalanceRef: context.depositedBalanceRef,
                poaBridgeInfoRef: context.poaBridgeInfoRef,
                backgroundQuoteRef: backgroundQuoteRef,
              }
            },
            onDone: {
              target: "idle",
              actions: {
                type: "setPreparationOutput",
                params: ({ event }) => event.output,
              },
            },
            onError: {
              target: "idle",
              actions: {
                type: "logError",
                params: ({ event }) => event,
              },
            },
          },

          entry: ["sendToBackgroundQuoterRefPause", "clearPreparationOutput"],
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

          assert(
            context.preparationOutput != null &&
              context.preparationOutput.tag === "ok",
            "not prepared"
          )

          const formValues = context.withdrawFormRef.getSnapshot().context
          const recipient = formValues.parsedRecipient
          assert(recipient, "recipient is null")

          return {
            userAddress: context.submitDeps.userAddress,
            userChainType: context.submitDeps.userChainType,
            defuseUserId: userAddressToDefuseUserId(
              context.submitDeps.userAddress,
              context.submitDeps.userChainType
            ),
            nearClient: context.submitDeps.nearClient,
            sendNearTransaction: context.submitDeps.sendNearTransaction,
            intentOperationParams: {
              type: "withdraw",
              tokenOut: formValues.tokenOut,
              quote: context.preparationOutput.value.swap?.swapQuote || null,
              nep141Storage: context.preparationOutput.value.nep141Storage,
              directWithdrawalAmount:
                context.preparationOutput.value.directWithdrawAvailable,
              recipient: recipient,
              destinationMemo: formValues.parsedDestinationMemo,
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

          actions: {
            type: "logError",
            params: ({ event }) => event,
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
