import { useQuery } from "@tanstack/react-query"
import { logger } from "../../../../../logger"
import { generateHLAddress } from "../../../../../sdk/hyperunit/apis"
import type { GeneratHLAddressParams } from "../../../../../sdk/hyperunit/types"
import type {
  BaseTokenInfo,
  SupportedChainName,
} from "../../../../../types/base"
import {
  getHyperliquidAsset,
  getHyperliquidSrcChain,
} from "../../../utils/hyperliquid"

export type HLDepositAddressResult =
  | {
      tag: "ok"
      value: {
        depositAddress: string
        chainName: GeneratHLAddressParams["srcChain"]
      } | null
    }
  | { tag: "err"; value: { reason: "ERR_HYPERLIQUID_ADDRESS_GENERATION" } }

export const useCreateHLDepositAddress = (
  token: BaseTokenInfo,
  blockchain: SupportedChainName,
  dstAddr: string
) => {
  return useQuery<HLDepositAddressResult>({
    queryKey: ["hyperliquid_deposit_address", { token, blockchain, dstAddr }],
    queryFn: async () => {
      try {
        if (blockchain !== "hyperliquid") {
          return {
            tag: "ok",
            value: null,
          }
        }
        const srcChain = getHyperliquidSrcChain(token)

        const response = await generateHLAddress({
          srcChain,
          dstChain: "hyperliquid",
          asset: getHyperliquidAsset(token),
          dstAddr,
        })
        return {
          tag: "ok",
          value: {
            depositAddress: response.address,
            chainName: srcChain,
          },
        }
      } catch (error) {
        logger.error(
          new Error("Failed to generate Hyperliquid deposit address", {
            cause: error,
          })
        )
        return {
          tag: "err",
          value: { reason: "ERR_HYPERLIQUID_ADDRESS_GENERATION" },
        }
      }
    },
    enabled: blockchain && dstAddr !== "",
  })
}
