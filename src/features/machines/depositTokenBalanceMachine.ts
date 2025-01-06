import { isNativeToken } from "src/utils/token"
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
    input: { derivedToken, userAddress, blockchain },
  }: {
    input: {
      derivedToken: BaseTokenInfo
      userAddress: string
      blockchain: SupportedChainName
    }
  }): Promise<{
    balance: bigint
    nearBalance: bigint | null
  } | null> => {
    const result: {
      balance: bigint
      nearBalance: bigint | null
    } | null = {
      balance: 0n,
      nearBalance: null,
    }

    if (!validateAddress(userAddress, blockchain)) {
      return result
    }

    const networkToSolverFormat = assetNetworkAdapter[blockchain]
    switch (networkToSolverFormat) {
      case BlockchainEnum.NEAR: {
        const [nep141Balance, nativeBalance] = await Promise.all([
          getNearNep141Balance({
            tokenAddress: derivedToken.address,
            accountId: normalizeToNearAddress(userAddress),
          }),
          getNearNativeBalance({
            accountId: normalizeToNearAddress(userAddress),
          }),
        ])
        // This is unique case for NEAR, where we need to sum up the native balance and the NEP-141 balance
        if (derivedToken.address === "wrap.near") {
          if (nep141Balance === null || nativeBalance === null) {
            throw new Error("Failed to fetch NEAR balances")
          }
          result.balance = nep141Balance + nativeBalance
          result.nearBalance = nativeBalance
          break
        }
        const balance = await getNearNep141Balance({
          tokenAddress: derivedToken.address,
          accountId: normalizeToNearAddress(userAddress),
        })
        if (balance === null) {
          throw new Error("Failed to fetch NEAR balances")
        }
        result.balance = balance
        result.nearBalance = nativeBalance
        break
      }
      case BlockchainEnum.ETHEREUM:
      case BlockchainEnum.BASE:
      case BlockchainEnum.ARBITRUM:
      case BlockchainEnum.TURBOCHAIN:
      case BlockchainEnum.AURORA: {
        if (isNativeToken(derivedToken)) {
          const balance = await getEvmNativeBalance({
            userAddress: userAddress as Address,
            rpcUrl: getWalletRpcUrl(networkToSolverFormat),
          })
          if (balance === null) {
            throw new Error("Failed to fetch EVM balances")
          }
          result.balance = balance
          break
        }
        const balance = await getEvmErc20Balance({
          tokenAddress: derivedToken.address as Address,
          userAddress: userAddress as Address,
          rpcUrl: getWalletRpcUrl(networkToSolverFormat),
        })
        if (balance === null) {
          throw new Error("Failed to fetch EVM balances")
        }
        result.balance = balance
        break
      }
      case BlockchainEnum.SOLANA: {
        const balance = await getSolanaNativeBalance({
          userAddress: userAddress,
          rpcUrl: getWalletRpcUrl(networkToSolverFormat),
        })
        if (balance === null) {
          throw new Error("Failed to fetch SOLANA balances")
        }
        result.balance = balance
        break
      }
      // Active deposits through Bitcoin and other blockchains are not supported, so we don't need to check balances
      case BlockchainEnum.BITCOIN:
      case BlockchainEnum.DOGECOIN:
      case BlockchainEnum.XRPLEDGER:
        break
      default:
        networkToSolverFormat satisfies never
        throw new Error("exhaustive check failed")
    }
    return result
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
          nearBalance: bigint | null
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
        derivedToken: BaseTokenInfo
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
          derivedToken: event.params.derivedToken,
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
                    nearBalance: event.output.nearBalance,
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
