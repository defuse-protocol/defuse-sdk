import { DepositBlockchainEnum } from "src/types"
import { parseDefuseAsset } from "src/utils"
import { fromPromise } from "xstate"
import { getNearNativeBalance, getNearNep141Balance } from "./getBalanceMachine"

export const backgroundBalanceActor = fromPromise(
  async ({
    input: { defuseAssetId, userAddress, network },
  }: {
    input: {
      defuseAssetId: string | null
      userAddress: string
      network: string | null
    }
  }): Promise<{
    balance: bigint
    nativeBalance: bigint
  }> => {
    if (defuseAssetId == null) {
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
      case DepositBlockchainEnum.NEAR:
        return {
          balance: assetAddress
            ? await getNearNep141Balance({
                tokenAddress: assetAddress,
                accountId: userAddress,
              })
            : 0n,
          nativeBalance: await getNearNativeBalance({ accountId: userAddress }),
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
