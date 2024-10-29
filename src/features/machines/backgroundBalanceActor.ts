import { fromPromise } from "xstate"
import { getNearNativeBalance, getNearNep141Balance } from "./getBalanceMachine"

export const backgroundBalanceActor = fromPromise(
  async ({
    input: { assetAddress, userAddress, network },
  }: {
    input: { assetAddress: string; userAddress: string; network: string }
  }): Promise<{
    balance: bigint
    nativeBalance: bigint
  }> => {
    if (assetAddress === "" || network === "") {
      return {
        balance: 0n,
        nativeBalance: 0n,
      }
    }
    switch (network) {
      case "near":
        return {
          balance: await getNearNep141Balance({
            tokenAddress: assetAddress,
            accountId: userAddress,
          }),
          nativeBalance: await getNearNativeBalance({ accountId: userAddress }),
        }
      default:
        throw new Error("backgroundBalanceActor not implemented")
    }
  }
)
