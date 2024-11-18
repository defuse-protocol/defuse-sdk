import {
  createDepositEVMERC20Transaction,
  getWalletRpcUrl,
} from "src/services/depositService"
import {
  estimateEVMErc20TransferCost,
  estimateEVMEtnTransferCost,
} from "src/services/estimateService"
import { BlockchainEnum, type SwappableToken } from "src/types"
import { isBaseToken, isUnifiedToken } from "src/utils"
import { reverseAssetNetworkAdapter } from "src/utils/adapters"
import { validateAddress } from "src/utils/validateAddress"
import type { Address } from "viem"
import { fromPromise } from "xstate"

// Estimate the gas cost for transferring the maximum balance
// Calculate the maximum transferable balance after accounting for gas cost
export const depositEstimateMaxValueActor = fromPromise(
  async ({
    input: {
      network,
      tokenAddress,
      userAddress,
      balance,
      nativeBalance,
      token,
      generateAddress,
    },
  }: {
    input: {
      network: BlockchainEnum
      tokenAddress: string
      userAddress: string
      balance: bigint
      nativeBalance: bigint
      token: SwappableToken
      generateAddress: string | null
    }
  }) => {
    switch (network) {
      case BlockchainEnum.NEAR:
        // Max value for NEAR is the sum of the native balance and the balance
        if (isBaseToken(token) && token?.address === "wrap.near") {
          return (nativeBalance || 0n) + (balance || 0n)
        }
        return balance
      case BlockchainEnum.ETHEREUM:
      case BlockchainEnum.BASE:
      case BlockchainEnum.ARBITRUM:
        if (
          !validateAddress(userAddress, reverseAssetNetworkAdapter[network]) ||
          generateAddress == null
        ) {
          return 0n
        }
        if (isUnifiedToken(token) && token.unifiedAssetId === "eth") {
          const gasCost = await estimateEVMEtnTransferCost({
            rpcUrl: getWalletRpcUrl(network),
            from: userAddress as Address,
            to: generateAddress as Address,
            value: nativeBalance,
          })
          const maxTransferableBalance = nativeBalance - gasCost
          return maxTransferableBalance > 0n ? maxTransferableBalance : 0n
        }
        // Wrappping to braces {} in order to create block scope for gasCost variable
        {
          const gasCost = await estimateEVMErc20TransferCost({
            rpcUrl: getWalletRpcUrl(network),
            from: userAddress as Address,
            to: tokenAddress as Address,
            data: createDepositEVMERC20Transaction(
              tokenAddress,
              generateAddress,
              balance
            ).data,
          })
          if (nativeBalance < gasCost) {
            return 0n
          }
          return balance
        }
      // Exception `case BlockchainEnum.BITCOIN:`
      // We don't do checks for Bitcoin as we don't support direct deposits to Bitcoin
      default:
        throw new Error("Unsupported network")
    }
  }
)
