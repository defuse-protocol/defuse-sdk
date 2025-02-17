import { providers } from "near-api-js"
import { settings } from "src/config/settings"
import { logger } from "src/logger"
import {
  type ActorRef,
  type Snapshot,
  assign,
  enqueueActions,
  fromPromise,
  setup,
} from "xstate"
import {
  getDepositedBalances,
  getTransitBalances,
} from "../../services/defuseBalanceService"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../types/base"
import type { ChainType } from "../../types/deposit"
import { assert } from "../../utils/assert"
import {
  type DefuseUserId,
  userAddressToDefuseUserId,
} from "../../utils/defuse"
import { isBaseToken } from "../../utils/token"

export type Context = {
  parentRef: ParentActor
  defuseTokenIds: string[]
  userAccountId: DefuseUserId | null
  balances: BalanceMapping
  onchainBalances: BalanceMapping
  transitBalances: BalanceMapping
  pendingDeltaBalances: BalanceMapping
  optimisticBalancesEnabled: boolean
}
export interface Input {
  parentRef: ParentActor
  tokenList: (BaseTokenInfo | UnifiedTokenInfo)[]
}

export type BalanceMapping = Record<BaseTokenInfo["defuseAssetId"], bigint>

type ParentReceivedEvents = {
  type: "BALANCE_CHANGED"
  params: {
    changedBalanceMapping: BalanceMapping
    changedTransitBalanceMapping: BalanceMapping
  }
}
export type ParentActor = ActorRef<Snapshot<unknown>, ParentReceivedEvents>

type SharedEvents = {
  type: "UPDATE_BALANCE_SLICE"
  params: {
    balanceSlice: BalanceMapping
    transitBalances: BalanceMapping
  }
}
type ThisActor = ActorRef<Snapshot<unknown>, SharedEvents>

export type Events =
  | {
      type: "LOGOUT"
    }
  | { type: "LOGIN"; params: { userAddress: string; userChainType: ChainType } }
  | {
      type: "REQUEST_BALANCE_REFRESH"
      // With optimistic balances enabled, we might have pending deltas
      params?: { pendingDeltaBalance: BalanceMapping }
    }

/**
 * @note context.balances - might be either on chain balances or optimistic balances
 * Optimistic balances are the sum of on chain balances, transit balances (in-flight), and pending delta balances (initiated intents in intent pool)
 *
 * Example:
 * - User has 0 USDC on chain
 * - User has 100 USDC in transit
 * - User swaps 100 USDC to 20 NEAR (20 NEAR added to pending delta balance at pool)
 *
 * - onchainBalances: { "USDC": 0n, "NEAR": 0n }
 * - transitBalances: { "USDC": 100n, "NEAR": 0n }
 * - pendingDeltaBalances: { "USDC": -100n, "NEAR": +20n }
 *
 * Resulting balances:
 * - balances: { "USDC": 0n +100n -100n, "NEAR": 0n +0n +20n }
 */

export const depositedBalanceMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Events | SharedEvents,
    input: {} as Input,
  },
  actors: {
    fetchBalanceActor: fromPromise(
      async ({
        input,
      }: {
        input: {
          parentRef: ThisActor
          userAccountId: DefuseUserId
          defuseTokenIds: string[]
        }
      }) => {
        const { parentRef, userAccountId } = input

        // If the token list is too large (>100 tokens) we should split it into multiple requests
        // and `UPDATE_BALANCE_SLICE` on receiving each response
        const balance = await getDepositedBalances(
          userAccountId,
          input.defuseTokenIds,
          new providers.JsonRpcProvider({
            url: "https://nearrpc.aurora.dev",
          })
        )

        const transitBalances = await getTransitBalances(
          userAccountId,
          input.defuseTokenIds
        )

        parentRef.send({
          type: "UPDATE_BALANCE_SLICE",
          params: {
            balanceSlice: balance,
            transitBalances,
          },
        })
      }
    ),
  },
  actions: {
    setUserAccountId: assign({
      userAccountId: (_, accountId: DefuseUserId) => accountId,
    }),
    clearUserAccountId: assign({
      userAccountId: null,
    }),
    updateBalance: enqueueActions(
      (
        { enqueue, context },
        params: {
          balanceSlice: BalanceMapping
          transitBalances: BalanceMapping
          pendingDeltaBalances: BalanceMapping
        }
      ) => {
        const { balances, onchainBalances } = properlyCalculateBalanceChanges({
          context,
          balances: context.balances,
          balanceSlice: params.balanceSlice,
          transitBalances: params.transitBalances,
          pendingDeltaBalances: params.pendingDeltaBalances,
          optimisticBalancesEnabled: context.optimisticBalancesEnabled,
        })

        if (Object.keys(onchainBalances).length > 0) {
          // First update the local state
          enqueue.assign({
            balances,
            transitBalances: params.transitBalances,
            onchainBalances,
            pendingDeltaBalances: params.pendingDeltaBalances,
          })
          // Then send the event to the parent
          enqueue(({ context }) => {
            context.parentRef.send({
              type: "BALANCE_CHANGED",
              params: {
                changedBalanceMapping: balances,
                changedTransitBalanceMapping: params.transitBalances,
              },
            })
          })
        }
      }
    ),
    clearBalance: assign({
      balances: {},
      transitBalances: {},
    }),
    setPendingDeltaBalances: assign({
      pendingDeltaBalances: ({ context, event }) => {
        if (
          event.type === "REQUEST_BALANCE_REFRESH" &&
          event.params?.pendingDeltaBalance
        ) {
          return event.params.pendingDeltaBalance
        }
        return context.pendingDeltaBalances
      },
    }),
    logError: (_, params: { error: unknown }) => {
      logger.error(params.error)
    },
  },
  guards: {
    // TODO: Either use this guard or remove it
    balanceDifferent: ({ context }, balanceSlice: BalanceMapping) => {
      for (const [key, val] of Object.entries(balanceSlice)) {
        if (context.balances[key] !== val) {
          return true
        }
      }
      return false
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBdICEBDAG0IDsBjMAYgBkB5AcQEkA5AbQAYBdRUDbDizoyfEAA9EAWgCMAZk4A6AOwBOAKwyALDM4A2PQCYAHOsMAaEAE9pM1XMWGDyrZ1VGty43vUBfX5YoArgEJORUioQArjgAFmBkQhSEeBB0TPQAqgAqXLxIIMFCImKSCLJy6oqqym52ZlrGnHaWNuWViuqchmqGJjIDcjp+ASBBmCEQRKSUYJEx8YlYyanUAEoAogCKmRsAytkA+vgAgrQnrADCG4ebAGKbewASeWJFwqIFZTKaipxahi0qhkxh+NWMWlatmMyk6jVUTnU9ns8j0-kCaAmqWm4Tm0TiCSSKUgigATmAAGbk2CxLBkKAAAgARmFZtQICI5nSAG7oADWcwpYBwFFiONma0prwK7xKX0QIIcehqXTkgJkhhq+ihCHs1XU8LkCMMXR0MnRY0xglCMwi+MWRNSZMp1Np9OZrKo1DApNJ6FJilQpBwFP9AFtFEKRWLPWBJRTpfwsR9SgqIYo5D5NPZujo+sYdfIlEMDXplJp-vpGhbxtaprH5gSlisSeSqXA3YyWbaaJkAAoAERO2Rup3OVxue1ozGuicKybloDKWj0xgzakzRlUxk1oJ1shhcOMCJ8yLkqJrVsm4rtC0Jy2JEEUWAgxBo4lgOGJkQpeFJAApdE4YCAEp2SvbEG3te8WyfF83znWVPiXRAzFURRdCRYDDAGbRlD0QtYVqJF1DUMtjG8TM5H8UYyHQFB4AKWtr1jN4F2QiRpDkZQZE6dR+Nqew5Ao9RKn3TNDCPBFjCNY9lHkkYMSKG1cUUKIyGg5tHzYwQU3ldpDAcfiBLcORhNMMTrGkVQlBwzw7AUIY9BkNRL2U+se0bB0H1SHTcD0lCED0BwNCzGQ9E8XptH3Hoqn+Y8eiBCKDX4tysRU2YvJgx9nXbGk6S7ViZXY1MEFw-Uwoi+SEWiqzylXRQKPPDQnBNDwtDSusbzxO8tKdeCwD84oOLKA10Ii3R5NMA0NWUQsjUUYKfAirRVpSiiaN8IA */
  id: "depositedBalance",

  initial: "unauthenticated",

  context: ({ input }) => {
    return {
      userAccountId: null,
      balances: {},
      transitBalances: {},
      onchainBalances: {},
      pendingDeltaBalances: {},
      parentRef: input.parentRef,
      defuseTokenIds: input.tokenList.flatMap((token) => {
        return isBaseToken(token)
          ? [token.defuseAssetId]
          : token.groupedTokens.map((t) => t.defuseAssetId)
      }),
      optimisticBalancesEnabled: settings.optimisticBalanceUpdates,
    }
  },

  states: {
    unauthenticated: {},

    authenticated: {
      initial: "refreshing balance",

      states: {
        "refreshing balance": {
          invoke: {
            src: "fetchBalanceActor",
            id: "fetchBalanceRef",
            input: ({ self, context }) => {
              assert(context.userAccountId != null, "User is not authenticated")
              return {
                parentRef: self,
                userAccountId: context.userAccountId,
                defuseTokenIds: context.defuseTokenIds,
              }
            },
            onDone: "idle",
            onError: {
              target: "idle",

              actions: [
                {
                  type: "logError",
                  params: () => {
                    return {
                      error: new Error("Error in fetch balance"),
                    }
                  },
                },
              ],

              reenter: true,
            },
          },

          on: {
            UPDATE_BALANCE_SLICE: {
              target: "refreshing balance",
              actions: {
                type: "updateBalance",
                params: ({ context, event }) => ({
                  balanceSlice: event.params.balanceSlice,
                  transitBalances: event.params.transitBalances,
                  pendingDeltaBalances: context.pendingDeltaBalances,
                }),
              },
            },
          },
        },

        idle: {
          after: {
            "10000": "refreshing balance",
          },
        },
      },

      on: {
        LOGOUT: {
          target: "unauthenticated",
          actions: ["clearBalance", "clearUserAccountId"],
          reenter: true,
        },

        REQUEST_BALANCE_REFRESH: {
          target: ".refreshing balance",
          actions: [
            {
              type: "setPendingDeltaBalances",
              params: ({ event }) => event,
            },
          ],
          reenter: true,
        },
      },
    },
  },

  on: {
    LOGIN: {
      target: ".authenticated",
      actions: [
        "clearBalance",
        {
          type: "setUserAccountId",
          params: ({ event }) =>
            userAddressToDefuseUserId(
              event.params.userAddress,
              event.params.userChainType
            ),
        },
      ],
      reenter: true,
    },
  },
})

export function prepareOptimisticBalanceUpdate(params: {
  onchainBalances: BalanceMapping
  transitBalances: BalanceMapping
  pendingDeltaBalances: BalanceMapping
}): BalanceMapping {
  const optimisticBalanceChanged: BalanceMapping = {}

  for (const [key, val] of Object.entries(params.onchainBalances)) {
    const sum =
      val +
      (params.transitBalances[key] || 0n) +
      (params.pendingDeltaBalances[key] || 0n)
    if (sum < 0n) {
      // biome-ignore lint/suspicious/noConsole: testing
      console.log(
        "Optimistic balance is negative, key:",
        key,
        "sum:",
        sum,
        "onchainBalance:",
        val,
        "transitBalance:",
        params.transitBalances[key],
        "pendingDeltaBalance:",
        params.pendingDeltaBalances[key]
      )
    }
    optimisticBalanceChanged[key] = sum
  }

  return optimisticBalanceChanged
}

export function properlyCalculateBalanceChanges(params: {
  context: Context
  balances: BalanceMapping
  balanceSlice: BalanceMapping
  transitBalances: BalanceMapping
  pendingDeltaBalances: BalanceMapping
  optimisticBalancesEnabled: boolean
}): {
  balances: BalanceMapping
  onchainBalances: BalanceMapping
} {
  const onchainBalanceChanged: BalanceMapping = {}
  const optimisticBalanceChanged: BalanceMapping = {}

  for (const [key, val] of Object.entries(params.balanceSlice)) {
    onchainBalanceChanged[key] = val ?? 0n
  }

  for (const [key, val] of Object.entries(onchainBalanceChanged)) {
    if (params.pendingDeltaBalances[key] !== val) {
      optimisticBalanceChanged[key] = val
    }
    optimisticBalanceChanged[key] = 0n
  }

  const balances = params.optimisticBalancesEnabled
    ? prepareOptimisticBalanceUpdate({
        onchainBalances: onchainBalanceChanged,
        transitBalances: params.transitBalances,
        pendingDeltaBalances: params.pendingDeltaBalances,
      })
    : { ...params.context.onchainBalances, ...onchainBalanceChanged }

  return {
    balances,
    onchainBalances: onchainBalanceChanged,
  }
}
