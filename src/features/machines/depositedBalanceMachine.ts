import { providers } from "near-api-js"
import {
  type ActorRef,
  type Snapshot,
  assign,
  enqueueActions,
  fromPromise,
  setup,
} from "xstate"
import { getDepositedBalances } from "../../services/defuseBalanceService"
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
  }
}
type ParentActor = ActorRef<Snapshot<unknown>, ParentReceivedEvents>

type SharedEvents = {
  type: "UPDATE_BALANCE_SLICE"
  params: {
    balanceSlice: BalanceMapping
  }
}
type ThisActor = ActorRef<Snapshot<unknown>, SharedEvents>

export type Events =
  | { type: "LOGOUT" | "REQUEST_BALANCE_REFRESH" }
  | { type: "LOGIN"; params: { userAddress: string; userChainType: ChainType } }

export const depositedBalanceMachine = setup({
  types: {
    context: {} as {
      parentRef: ParentActor
      defuseTokenIds: string[]
      userAccountId: DefuseUserId | null
      balances: BalanceMapping
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

        parentRef.send({
          type: "UPDATE_BALANCE_SLICE",
          params: { balanceSlice: balance },
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
      ({ enqueue, context }, params: BalanceMapping) => {
        const changed: BalanceMapping = {}

        for (const [key, val] of Object.entries(params)) {
          if (context.balances[key] !== val) {
            changed[key] = val
          }
        }

        if (Object.keys(changed).length > 0) {
          // First update the local state
          enqueue.assign({
            balances: () => ({ ...context.balances, ...changed }),
          })
          // Then send the event to the parent
          enqueue(({ context }) => {
            context.parentRef.send({
              type: "BALANCE_CHANGED",
              params: { changedBalanceMapping: changed },
            })
          })
        }
      }
    ),
    clearBalance: assign({
      balances: {},
    }),
  },
  guards: {
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
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBdICEBDAG0IDsBjMAYgBkB5AcQEkA5AbQAYBdRUDbDizoyfEAA9EAWgCMAZk4A6AOwBOAKwyALJ1UA2ZXLnqANCACe0mQA45ivda2G9WgExyt15VoC+PsygCuAQk5FSKhACuOAAWYGRCFIR4EHRM9ACqACpcvEggQUIiYpIIssaKqsq6Mhqunpw2ymaWZR4qWnWOnHKunH3WfgFomMEQRKSUYBHRcQlYSSmKAE5gAGarsDFYZFAABABGoVPUECLTOwBu6ADW02tgOBQxE2FgAErruWKFwqL5pRktUU6ms1k4WgU1Tkelc6i0LUQehkikakIc8Lk3j0qkG-hAgVGKVeUxmsXiiWSkBW602212h2OVGoGQACgARACCWQAogB9fCc2ic1gAYX5AGVaMxxd98r9igDEOpXCjlDJNMjXGoVdZTBZpAZFNZkRD1T14eo9EMCSNBCFJuEouT5otqVgIMQaOJYDgqRE1nhlgAKGSccOcACUpztYxJTtmFIWVIgig9Xrl-CJfxKiA81lRtnUqlUnAcVVU2kRCGRqO0ML1kO8yhthPt4yZ02dc0pKWo7x5AEUMjyJVkBUKReK+QOAGIDiUACUzBWzitAgM0ijktmRNlq6mUh9c1dkejsO-ccPqnBNEL8+LI6BQ8HybbjnZ+a-+G+kO6Uxb5g4Xhli4p5GAW-TWDY9S9KoqpyK2sbEp2iiRGQ3ZJm6EBfoIOZKm0vQgqoQFgtUehgQaCBKBoPRaMW546N4ep4sMhQOm8ZI9smKS4bg+G-jWdgaHo6iak4aiqgiVFSHCSjVCqLgUXoEJwqxtrsR2jpdomropjSGxwPS+xHNpfFFD+EiIECKIiWJMguMoklVjJDjGrYB6uLCVr1L4+Lvih2lcVh+npmA5kCVZCCuNBqLFjFKlgpCRjSa08h2OeJadNYcL0VCD4+EAA */
  id: "depositedBalance",

  initial: "unauthenticated",

  context: ({ input }) => {
    return {
      userAccountId: null,
      balances: {},
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
                params: ({ event }) => event.params.balanceSlice,
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
