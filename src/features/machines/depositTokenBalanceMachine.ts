import type { Address } from "viem"
import { assign, fromPromise, setup } from "xstate"
import { getWalletRpcUrl } from "../../services/depositService"
import type { BaseTokenInfo, SupportedChainName } from "../../types/base"
import { BlockchainEnum } from "../../types/interfaces"
import { assetNetworkAdapter } from "../../utils/adapters"
import { validateAddress } from "../../utils/validateAddress"
import {
  getEvmErc20Balance,
  getEvmNativeBalance,
  getNearNativeBalance,
  getNearNep141Balance,
  getSolanaNativeBalance,
} from "./getBalanceMachine"

export const backgroundBalanceActor = fromPromise(
  async ({
    input: { tokenAddress, userAddress, blockchain },
  }: {
    input: {
      tokenAddress: string
      userAddress: string
      blockchain: SupportedChainName
    }
  }): Promise<{
    balance: bigint
    nativeBalance: bigint
  } | null> => {
    if (!validateAddress(userAddress, blockchain)) {
      return null
    }
    const networkToSolverFormat = assetNetworkAdapter[blockchain]
    switch (networkToSolverFormat) {
      case BlockchainEnum.NEAR:
        return {
          balance:
            (await getNearNep141Balance({
              tokenAddress: tokenAddress,
              accountId: normalizeToNearAddress(userAddress),
            })) ?? 0n,
          nativeBalance:
            (await getNearNativeBalance({
              accountId: normalizeToNearAddress(userAddress),
            })) ?? 0n,
        }
      case BlockchainEnum.ETHEREUM:
      case BlockchainEnum.BASE:
      case BlockchainEnum.ARBITRUM:
      case BlockchainEnum.TURBOCHAIN:
      case BlockchainEnum.AURORA:
        return {
          balance:
            (await getEvmErc20Balance({
              tokenAddress: tokenAddress as Address,
              userAddress: userAddress as Address,
              rpcUrl: getWalletRpcUrl(networkToSolverFormat),
            })) ?? 0n,
          nativeBalance:
            (await getEvmNativeBalance({
              userAddress: userAddress as Address,
              rpcUrl: getWalletRpcUrl(networkToSolverFormat),
            })) ?? 0n,
        }
      case BlockchainEnum.SOLANA:
        return {
          balance: 0n,
          nativeBalance:
            (await getSolanaNativeBalance({
              userAddress: userAddress,
              rpcUrl: getWalletRpcUrl(networkToSolverFormat),
            })) ?? 0n,
        }
      // Active deposits through Bitcoin, Dogecoin are not supported, so we don't need to check balances
      case BlockchainEnum.BITCOIN:
      case BlockchainEnum.DOGECOIN:
      case BlockchainEnum.XRPLEDGER:
        return {
          balance: 0n,
          nativeBalance: 0n,
        }
      default:
        networkToSolverFormat satisfies never
        throw new Error("exhaustive check failed")
    }
  }
)

function normalizeToNearAddress(address: string): string {
  return address.toLowerCase()
}

export interface Context {
  preparationOutput:
    | {
        tag: "ok"
        value: {
          balance: bigint
          nativeBalance: bigint
        }
      }
    | {
        tag: "err"
        value: { reason: "ERR_FETCH_BALANCE" }
      }
    | null
}

export const depositTokenBalanceMachine = setup({
  types: {
    context: {} as Context,
    events: {} as {
      type: "REQUEST_BALANCE_REFRESH"
      params: {
        token: BaseTokenInfo
        userAddress: string
        blockchain: SupportedChainName
      }
    },
  },
  actors: {
    fetchBalanceActor: backgroundBalanceActor,
  },
  actions: {
    clearBalance: assign({
      preparationOutput: null,
    }),
  },
  guards: {},
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBdICEBDAG0IDsBjMAYgCUBRARQFV6BlAFQH18BBAGV4A5AML0uDAGIM2ACQDaABgC6iUBmw4s6MmpAAPRAFoATABYArADoTADgDM9gJwB2M2fuKXARlsA2ABoQAE9jbydbKxcLF3Mvew9bE1iAXxSglA1cAhJyKisAMzAcCgALLDIoaggdMCsKgDd0AGs6zMxsiCJSSjqikvLKhEb0CkItHSVlKb0sid0kA2MTb3srJz8-JyczW1sLOL8XINCEMycrJO8fC19bRQt9kzSMtA68LtzewuKyiqqwAAnQHoQFWVCkHAFUEAWys7U0OR6+X6fyGIzG8ymM0Wc20C1AhgQplWNm2insLic4RcR1sZhOiG8JjWGws9m87JZjnuzxeIDI6BQ8EWCM63TyYFm73xeiJRns9MuzKpfnsW05HMZxLsfhsMXMB1ifnZLn5Yo+Eu+WAgxCluJlOjlxkcetsKo26up7O82qMq28628FJM1J87v8fnNb0Rn2RfV+gyg0s0ssW8pMySsuxMfncwcU3jMJvsfu85asiirVZN7icijVZmjcyRkqsFHQMIhxUgKdwacJYRciisfgpbgeWz8vl22rsLmzhdsrh8ZkUDgsaTSQA */
  id: "depositedBalance",

  context: {
    preparationOutput: null,
  },

  initial: "idle",

  states: {
    idle: {},

    fetching: {
      invoke: {
        src: "fetchBalanceActor",

        input: ({ event }) => ({
          tokenAddress: event.params.token.address,
          userAddress: event.params.userAddress,
          blockchain: event.params.blockchain,
        }),

        onDone: {
          target: "completed",
          actions: assign({
            preparationOutput: ({ event }) => {
              if (event.output) {
                return {
                  tag: "ok",
                  value: {
                    balance: event.output.balance,
                    nativeBalance: event.output.nativeBalance,
                  },
                }
              }
              return null
            },
          }),
        },
        onError: {
          target: "completed",
          actions: assign({
            preparationOutput: {
              tag: "err",
              value: {
                reason: "ERR_FETCH_BALANCE",
              },
            },
          }),
          reenter: true,
        },
      },
    },

    completed: {},
  },

  on: {
    REQUEST_BALANCE_REFRESH: ".fetching",
  },
})
