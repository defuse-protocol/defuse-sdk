import { getWalletRpcUrl } from "src/services/depositService"
import { BlockchainEnum } from "src/types"
import { reverseAssetNetworkAdapter } from "src/utils/adapters"
import { validateAddress } from "src/utils/validateAddress"
import type { Address } from "viem"
import { fromPromise } from "xstate"
import {
  getEvmErc20Balance,
  getEvmNativeBalance,
  getNearNativeBalance,
  getNearNep141Balance,
  getSolanaNativeBalance,
} from "./getBalanceMachine"

export const backgroundBalanceActor = fromPromise(
  async ({
    input: { tokenAddress, userAddress, network },
  }: {
    input: {
      tokenAddress: string
      userAddress: string
      network: BlockchainEnum
    }
  }): Promise<{
    balance: bigint
    nativeBalance: bigint
  } | null> => {
    if (!validateAddress(userAddress, reverseAssetNetworkAdapter[network])) {
      return null
    }

    switch (network) {
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
        return {
          balance:
            (await getEvmErc20Balance({
              tokenAddress: tokenAddress as Address,
              userAddress: userAddress as Address,
              rpcUrl: getWalletRpcUrl(network),
            })) ?? 0n,
          nativeBalance:
            (await getEvmNativeBalance({
              userAddress: userAddress as Address,
              rpcUrl: getWalletRpcUrl(network),
            })) ?? 0n,
        }
      case BlockchainEnum.SOLANA:
        return {
          balance: 0n,
          nativeBalance:
            (await getSolanaNativeBalance({
              userAddress: userAddress,
              rpcUrl: getWalletRpcUrl(network),
            })) ?? 0n,
        }
      // Active deposits through Bitcoin, Dogecoin are not supported, so we don't need to check balances
      case BlockchainEnum.BITCOIN:
      case BlockchainEnum.DOGECOIN:
        return {
          balance: 0n,
          nativeBalance: 0n,
        }
      default:
        network satisfies never
        throw new Error("exhaustive check failed")
    }
  }
)

function normalizeToNearAddress(address: string): string {
  return address.toLowerCase()
}
