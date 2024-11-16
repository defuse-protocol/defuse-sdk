import { getWalletRpcUrl } from "src/services/depositService"
import { estimateEthTransferCost } from "src/services/estimateService"
import { BlockchainEnum, type SwappableToken } from "src/types"
import { isBaseToken, isUnifiedToken } from "src/utils"
import type { RpcUrl } from "src/utils/defuse"
import { fromPromise } from "xstate"

export const depositEstimateMaxValueActor = fromPromise(
  async ({
    input: { token, network, balance, nativeBalance },
  }: {
    input: {
      token: SwappableToken
      network: BlockchainEnum
      balance: bigint
      nativeBalance: bigint
    }
  }) => {
    const rpcUrl = getWalletRpcUrl(network)
    switch (network) {
      case BlockchainEnum.NEAR:
        // Max value for NEAR is the sum of the native balance and the balance
        if (isBaseToken(token) && token?.address === "wrap.near") {
          return (nativeBalance || 0n) + (balance || 0n)
        }
        break
      case BlockchainEnum.ETHEREUM:
      case BlockchainEnum.BASE:
      case BlockchainEnum.ARBITRUM:
        if (isUnifiedToken(token) && token.unifiedAssetId === "eth") {
          if (!rpcUrl) return 0n
          const transferCost =
            rpcUrl &&
            (await estimateEthTransferCost({
              rpcUrl: rpcUrl as RpcUrl,
              to: "0x0000000000000000000000000000000000000000",
              data: "0x",
            }))
          return nativeBalance - (transferCost || 0n)
        }
        break
      // Exception `case BlockchainEnum.BITCOIN:`
      // We don't do checks for Bitcoin as we don't support direct deposits to Bitcoin
      default:
        throw new Error("Unsupported network")
    }
  }
)
