import { getWalletRpcUrl } from "src/services/depositService"
import { BlockchainEnum, type SupportedChainName } from "src/types"
import { assetNetworkAdapter } from "src/utils/adapters"
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
