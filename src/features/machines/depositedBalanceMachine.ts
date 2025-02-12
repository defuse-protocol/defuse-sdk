import { providers } from "near-api-js"
import { settings } from "src/config/settings"
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
type ParentActor = ActorRef<Snapshot<unknown>, ParentReceivedEvents>

type SharedEvents = {
  type: "UPDATE_BALANCE_SLICE"
  params: {
    balanceSlice: BalanceMapping
    transitBalanceSlice: BalanceMapping
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
    context: {} as {
      parentRef: ParentActor
      defuseTokenIds: string[]
      userAccountId: DefuseUserId | null
      balances: BalanceMapping
      onchainBalances: BalanceMapping
      transitBalances: BalanceMapping
      pendingDeltaBalances: BalanceMapping
    },
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
            transitBalanceSlice: transitBalances,
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
          transitBalanceSlice: BalanceMapping
          pendingDeltaBalance: BalanceMapping
        }
      ) => {
        const balanceChanged: BalanceMapping = {}
        const transitBalanceChanged: BalanceMapping = {}
        let optimisticBalanceChanged: BalanceMapping = {}

        for (const [key, val] of Object.entries(params.balanceSlice)) {
          if (context.balances[key] !== val) {
            balanceChanged[key] = val
          }
        }

        for (const [key, val] of Object.entries(params.transitBalanceSlice)) {
          if (context.transitBalances[key] !== val) {
            transitBalanceChanged[key] = val
          }
        }

        const onchainBalanceChanged = {
          ...context.onchainBalances,
          ...balanceChanged,
        }

        if (settings.optimisticBalanceUpdates) {
          optimisticBalanceChanged = prepareOptimisticBalanceUpdate({
            onchainBalances: onchainBalanceChanged,
            transitBalanceChanged,
            pendingDeltaBalance: params.pendingDeltaBalance,
          })
        }

        const balances = settings.optimisticBalanceUpdates
          ? optimisticBalanceChanged
          : { ...context.onchainBalances, ...balanceChanged }

        if (
          Object.keys(balanceChanged).length > 0 ||
          Object.keys(transitBalanceChanged).length > 0
        ) {
          // First update the local state
          enqueue.assign({
            balances,
            transitBalances: transitBalanceChanged,
            onchainBalances: onchainBalanceChanged,
            pendingDeltaBalances: params.pendingDeltaBalance,
          })
          // Then send the event to the parent
          enqueue(({ context }) => {
            context.parentRef.send({
              type: "BALANCE_CHANGED",
              params: {
                changedBalanceMapping: balanceChanged,
                changedTransitBalanceMapping: transitBalanceChanged,
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
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBdICEBDAG0IDsBjMAYgBkB5AcQEkA5AbQAYBdRUDbDizoyfEAA9EAWgCMAZk4A6AOwBOAKwyALJ1UA2ZXLnqANCACe0mQA45ivda2G9WgExyt15VoC+PsygCuAQk5FSKhACuOAAWYGRCFIR4EHRM9ACqACpcvEggQUIiYpIIssaKqsq6Mhqunpw2ymaWZR4qWnWOnHKunH3WfgFomMEQRKSUYBHRcQlYSSnUAEoAogCKGasAylkA+vgAgrSHrADCq3trAGJr2wASuWKFwqL5pTKainK2ejI2tXUyiBrhaVj0dh+7lc6nqnGsek4vn8IECoxSEzC0yisXiiWSkEUACcwAAzEmwGJYMhQAAEACNQlNqBARNNqQA3dAAa2mpLAOAoMUxU2WZKe+RexXeiH+qkU6ms1iRCmqcj0MK0YIQf0UjS06us6gN3j0qkGKLRghCk3COLm+JSxLJFKpNIZTKo1AyAAUACKHLKXI4nc6Xba0ZgXCX8dGvEqIWEyFSfGR-VxqWFG7VSAyKBEyJHKQvGLTqPRDVEja3jT3Y2Z4hYEiCKLAQYg0cSwHAEiKkvBEgAU6k4o4AlCzq2MRXaG-NFoS2x2YwU49LQKUPMmtNoNRDNY5QRZELr9YbjXJTea-CiyOgUPB8lbp3Xnmu3hvpD8lOpVB4EUq1R6C4OZGNY3zWO4qZKoWqiuBWlpThidaKJEZD2o2C4QG+gjxjKbS9Aqf6eA4XicMBWrHggSgaD0Zb6B4nDeEaFrDIUNpYjMuLzs2OG4Hhn46nYGh6OomguMoaiuNoOYwkoSrQv02ieJ4riVs+yG2vW3GOoSJLknAbp0oyWl8UUH4SLK-yVOWYlpk4UkyVRubgUqciAvBMIaloyJseiHFTFxDpNk6S5gGZAmWQgrjWMmnC-jFiJKgaRiUa08h2BCqiqJ0kHGuoqo3j4QA */
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
            // todo: handle error
          },

          on: {
            UPDATE_BALANCE_SLICE: {
              target: "refreshing balance",
              actions: {
                type: "updateBalance",
                params: ({ context, event }) => ({
                  balanceSlice: event.params.balanceSlice,
                  transitBalanceSlice: event.params.transitBalanceSlice,
                  pendingDeltaBalance: context.pendingDeltaBalances,
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

function prepareOptimisticBalanceUpdate({
  onchainBalances,
  transitBalanceChanged,
  pendingDeltaBalance,
}: {
  onchainBalances: BalanceMapping
  transitBalanceChanged: BalanceMapping
  pendingDeltaBalance: BalanceMapping
}): BalanceMapping {
  const optimisticBalanceChanged: BalanceMapping = {}

  for (const [key, val] of Object.entries(onchainBalances)) {
    optimisticBalanceChanged[key] =
      val +
      (transitBalanceChanged[key] || 0n) +
      (pendingDeltaBalance[key] || 0n)
  }

  return optimisticBalanceChanged
}
