import {
  type ActorRefFrom,
  type SnapshotFrom,
  type Values,
  assign,
  fromPromise,
  setup,
  waitFor,
} from "xstate"
import { logger } from "../../logger"
import { getSupportedTokens, type types } from "../../services/poaBridgeClient"
import type { BaseTokenInfo } from "../../types/base"

export interface Context {
  bridgeInfo: Record<
    BaseTokenInfo["defuseAssetId"],
    {
      minDeposit: bigint
      minWithdrawal: bigint
      withdrawalFee: number
    }
  >
}

export const poaBridgeInfoActor = setup({
  types: {
    context: {} as Context,
  },
  actors: {
    fooActor: fromPromise(async () => {
      return getSupportedTokens({})
    }),
  },
  actions: {
    logError: (_, err: Error) => {
      logger.error(err)
    },
    setBridgeInfo: assign({
      bridgeInfo: (
        _,
        bridgeInfo: types.GetSupportedTokensResponse["result"]
      ) => {
        const arr = bridgeInfo.tokens.map(
          (
            bridgedTokenInfo
          ): [keyof Context["bridgeInfo"], Values<Context["bridgeInfo"]>] => {
            return [
              `nep141:${bridgedTokenInfo.near_token_id}`,
              {
                minDeposit: BigInt(bridgedTokenInfo.min_deposit_amount),
                minWithdrawal: BigInt(bridgedTokenInfo.min_withdrawal_amount),
                withdrawalFee: Number(bridgedTokenInfo.withdrawal_fee),
              },
            ]
          }
        )

        return Object.fromEntries(arr)
      },
    }),
  },
}).createMachine({
  id: "bridgeInfo",

  context: () => ({
    bridgeInfo: {},
    error: null,
  }),

  initial: "idle",

  states: {
    idle: {
      on: { FETCH: "loading" },
    },
    loading: {
      invoke: {
        src: "fooActor",
        onDone: {
          target: "success",
          actions: {
            type: "setBridgeInfo",
            params: ({ event }) => event.output,
          },
        },
        onError: {
          target: "error",
          actions: {
            type: "logError",
            params: ({ event }) => toError(event.error),
          },
        },
      },
    },
    success: {
      type: "final",
    },
    error: {
      on: { FETCH: "loading" },
    },
  },
})

export const waitPOABridgeInfoActor = fromPromise(
  ({
    input,
    signal,
  }: {
    input: {
      actorRef: ActorRefFrom<typeof poaBridgeInfoActor>
    }
    signal: AbortSignal
  }) => {
    return waitFor(input.actorRef, (state) => state.matches("success"), {
      timeout: 10000,
      signal,
    })
  }
)

export const getPOABridgeInfo = (
  state: SnapshotFrom<typeof poaBridgeInfoActor>,
  token: BaseTokenInfo | BaseTokenInfo["defuseAssetId"]
) => {
  if (!state.matches("success")) return null

  return (
    state.context.bridgeInfo[
      typeof token === "object" ? token.defuseAssetId : token
    ] ?? {
      minDeposit: 1n,
      minWithdrawal: 1n,
      withdrawalFee: 0,
    }
  )
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("unknown error")
}
