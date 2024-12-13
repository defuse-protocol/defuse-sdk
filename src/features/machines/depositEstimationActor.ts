import {
  createDepositEVMERC20Transaction,
  getWalletRpcUrl,
} from "src/services/depositService"
import {
  estimateEVMTransferCost,
  estimateSolanaTransferCost,
} from "src/services/estimateService"
import { BlockchainEnum, type SwappableToken } from "src/types"
import { isBaseToken, isNativeToken, isUnifiedToken } from "src/utils"
import { reverseAssetNetworkAdapter } from "src/utils/adapters"
import { validateAddress } from "src/utils/validateAddress"
import type { Address } from "viem"
import { fromPromise } from "xstate"
import { getEVMChainId } from "../../utils/evmChainId"

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
      case BlockchainEnum.TURBOCHAIN: {
        if (
          !validateAddress(userAddress, reverseAssetNetworkAdapter[network]) ||
          generateAddress == null
        ) {
          return 0n
        }
        // TODO: Disable this for now as we have issue with estimation of gas cost.
        // const chainId = getEVMChainId(reverseAssetNetworkAdapter[network])
        // if (isUnifiedToken(token) && token.groupedTokens.some(isNativeToken)) {
        //   const gasCost = await estimateEVMTransferCost({
        //     rpcUrl: getWalletRpcUrl(network),
        //     from: userAddress as Address,
        //     to: generateAddress as Address,
        //     value: nativeBalance,
        //   })
        //   const maxTransferableBalance = nativeBalance - gasCost
        //   return maxTransferableBalance > 0n ? maxTransferableBalance : 0n
        // }
        // const gasCost = await estimateEVMTransferCost({
        //   rpcUrl: getWalletRpcUrl(network),
        //   from: userAddress as Address,
        //   to: tokenAddress as Address,
        //   data: createDepositEVMERC20Transaction(
        //     userAddress,
        //     tokenAddress,
        //     generateAddress,
        //     balance,
        //     chainId
        //   ).data,
        // })
        // if (nativeBalance < gasCost) {
        //   return 0n
        // }
        return balance
      }
      case BlockchainEnum.SOLANA: {
        const fee = estimateSolanaTransferCost()
        if (nativeBalance < fee) {
          return 0n
        }
        return nativeBalance - fee
      }
      // Active deposits through Bitcoin, Dogecoin are not supported, so no network fees
      case BlockchainEnum.BITCOIN:
      case BlockchainEnum.DOGECOIN:
        return 0n
      default:
        network satisfies never
        throw new Error("exhaustive check failed")
    }
  }
)
