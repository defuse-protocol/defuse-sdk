import { BlockchainEnum } from "src/types"
import { fromPromise } from "xstate"
import { parseDefuseAsset } from "../../utils/parseDefuseAsset"
import {
  getEvmErc20Balance,
  getEvmNativeBalance,
  getNearNativeBalance,
  getNearNep141Balance,
} from "./getBalanceMachine"

export const backgroundBalanceActor = fromPromise(
  async ({
    input: { defuseAssetId, tokenAddress, userAddress, network, rpcUrl },
  }: {
    input: {
      defuseAssetId: string | null
      tokenAddress: string | null
      userAddress: string
      network: string | null
      rpcUrl: string | undefined
    }
  }): Promise<{
    balance: bigint
    nativeBalance: bigint
  }> => {
    if (!defuseAssetId || !network || !userAddress) {
      return {
        balance: 0n,
        nativeBalance: 0n,
      }
    }

    let assetAddress: string | null = null
    if (isNearDefuseAssetId(defuseAssetId)) {
      const result = parseNearDefuseAssetId(defuseAssetId)
      assetAddress = result?.contractId ?? null
    } else {
      const result = parseDefuseAsset(defuseAssetId)
      assetAddress = result?.contractId ?? null
    }

    switch (network) {
      case BlockchainEnum.NEAR:
        return {
          balance: assetAddress
            ? ((await getNearNep141Balance({
                tokenAddress: assetAddress,
                accountId: userAddress,
              })) ?? 0n)
            : 0n,
          nativeBalance:
            (await getNearNativeBalance({ accountId: userAddress })) ?? 0n,
        }
      case BlockchainEnum.ETHEREUM:
      case BlockchainEnum.BASE:
      case BlockchainEnum.ARBITRUM:
        return {
          balance:
            rpcUrl && tokenAddress
              ? ((await getEvmErc20Balance({
                  tokenAddress,
                  userAddress,
                  rpcUrl,
                })) ?? 0n)
              : 0n,
          nativeBalance: rpcUrl
            ? ((await getEvmNativeBalance({ userAddress, rpcUrl })) ?? 0n)
            : 0n,
        }
      default:
        return {
          balance: 0n,
          nativeBalance: 0n,
        }
    }
  }
)

export function parseNearDefuseAssetId(
  defuseAssetId: string
): { standard: string; contractId: string } | null {
  try {
    const [standard, contractId] = defuseAssetId.split(":")
    return {
      standard: standard as string,
      contractId: contractId as string,
    }
  } catch (e) {
    console.error("Failed to parse near defuse asset id", e)
    return null
  }
}

export function isNearDefuseAssetId(defuseAssetId: string): boolean {
  return defuseAssetId.startsWith("nep141:")
}
