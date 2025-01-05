import {
  createDepositEVMERC20Transaction,
  getWalletRpcUrl,
} from "src/services/depositService"
import { assert } from "src/utils/assert"
import { getEVMChainId } from "src/utils/evmChainId"
import type { Address } from "viem"
import { assign, fromPromise, setup } from "xstate"
import {
  estimateEVMTransferCost,
  estimateSolanaTransferCost,
} from "../../services/estimateService"
import type { BaseTokenInfo, SupportedChainName } from "../../types/base"
import { BlockchainEnum } from "../../types/interfaces"
import { assetNetworkAdapter } from "../../utils/adapters"
import { isBaseToken, isNativeToken } from "../../utils/token"
import { validateAddress } from "../../utils/validateAddress"

export const depositEstimateMaxValueActor = fromPromise(
  async ({
    input: {
      blockchain,
      userAddress,
      balance,
      nearBalance,
      token,
      generateAddress,
    },
  }: {
    input: {
      blockchain: SupportedChainName
      tokenAddress: string
      userAddress: string
      balance: bigint
      nearBalance: bigint | null
      token: BaseTokenInfo
      generateAddress: string | null
    }
  }): Promise<bigint> => {
    const networkToSolverFormat = assetNetworkAdapter[blockchain]
    switch (networkToSolverFormat) {
      case BlockchainEnum.NEAR:
        assert(nearBalance !== null, "Near balance is required")
        // Max value for NEAR is the sum of the native balance and the balance
        if (isBaseToken(token) && token.address === "wrap.near") {
          return nearBalance + balance
        }
        return balance
      case BlockchainEnum.ETHEREUM:
      case BlockchainEnum.BASE:
      case BlockchainEnum.ARBITRUM:
      case BlockchainEnum.TURBOCHAIN:
      case BlockchainEnum.AURORA: {
        if (
          !validateAddress(userAddress, blockchain) ||
          generateAddress == null
        ) {
          return 0n
        }
        const rpcUrl = getWalletRpcUrl(assetNetworkAdapter[blockchain])
        if (isNativeToken(token)) {
          const gasCost = await estimateEVMTransferCost({
            rpcUrl,
            from: userAddress as Address,
            to: generateAddress as Address,
            value: balance,
          })
          const maxTransferableBalance = balance - gasCost
          return maxTransferableBalance > 0n ? maxTransferableBalance : 0n
        }
        const chainId = getEVMChainId(blockchain)
        const gasCost = await estimateEVMTransferCost({
          rpcUrl,
          from: userAddress as Address,
          to: token.address as Address,
          data: createDepositEVMERC20Transaction(
            userAddress,
            token.address,
            generateAddress,
            balance,
            chainId
          ).data,
        })
        if (balance < gasCost) {
          return 0n
        }
        return balance
      }
      case BlockchainEnum.SOLANA: {
        const fee = estimateSolanaTransferCost()
        if (balance < fee) {
          return 0n
        }
        return balance - fee
      }
      // Active deposits through Bitcoin, Dogecoin are not supported, so no network fees
      case BlockchainEnum.BITCOIN:
      case BlockchainEnum.DOGECOIN:
      case BlockchainEnum.XRPLEDGER:
        return 0n
      default:
        networkToSolverFormat satisfies never
        throw new Error("exhaustive check failed")
    }
  }
)

export interface Context {
  preparationOutput:
    | {
        tag: "ok"
        value: {
          maxDepositValue: bigint
        }
      }
    | {
        tag: "err"
        value: { reason: "ERR_ESTIMATE_MAX_DEPOSIT_VALUE" }
      }
    | null
}

export const depositEstimationMachine = setup({
  types: {
    context: {} as Context,
    events: {} as {
      type: "REQUEST_ESTIMATE_MAX_DEPOSIT_VALUE"
      params: {
        blockchain: SupportedChainName
        userAddress: string
        balance: bigint
        nearBalance: bigint | null
        token: BaseTokenInfo
        generateAddress: string | null
      }
    },
  },
  actors: {
    estimateMaxDepositValueActor: depositEstimateMaxValueActor,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QTABwPawJYBcCisOWAtgIZHoB2AxAEp4CKAqngMoAqA+m+wJICyAQXZ5OQgBqcAIngAKAeVa8uANUEAZFgG0ADAF1EoDNgqVDIAB6IALACYANCACeiAIw7bAOgCcAdgBs-q4AHNZ23h4ArLYAvjGOKMa4BERkpp5wqeRYlFDUEFRgnjkAbugA1kWJmMmEJNlUGXVpOVAIpegAxg2Uunp95kmm5lYIwa6ewb6ROq6uAMzuHq7WwY4uCPPRnovBtr6ufjoB1t6RcQloNfjNPU1ZRLnUYABOL+gvnqgANuQAZh9iJ5qiYUvV0plwa12pQyt1TH0BkgQEMsFQRog9p5IuEDqd5gFXJFfOsbLZrD4QvN-MFvLZXL5rDS4vEQJR0Ch4MiQbUHmizMjUejkaMALS+eaeFbjBl2HRhKb+UkIImeawBSLBeWRGmMsLWC4gHk3PmNLAQb5gQbXfkYhCi2yRKWrOaM2zy1bTJXONxatWhKaRbxzUL+CWG41glqNSEtXLWky2kWIGk7IME4PE7zeGnWZWHCmLfzzT3Z1z+JkG1mR27pTroYg-MA4SAJ3BJ0CjcsUvz+YkHYvWHTHSLKnX+Ty+bxbEs6PY6fzTlkxIA */
  id: "depositEstimation",

  context: {
    preparationOutput: null,
  },

  initial: "idle",

  states: {
    idle: {},

    estimating: {
      invoke: {
        src: "estimateMaxDepositValueActor",
        input: ({ event }) => {
          return {
            ...event.params,
            tokenAddress: event.params.token.address,
          }
        },

        onDone: {
          target: "completed",
          actions: assign({
            preparationOutput: ({ event }) => {
              if (event.output) {
                return {
                  tag: "ok",
                  value: {
                    maxDepositValue: event.output,
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
              value: { reason: "ERR_ESTIMATE_MAX_DEPOSIT_VALUE" },
            },
          }),
          reenter: true,
        },
      },
    },
    completed: {},
  },

  on: {
    REQUEST_ESTIMATE_MAX_DEPOSIT_VALUE: ".estimating",
  },
})
