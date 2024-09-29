import { CallRequestIntentProps, INDEXER } from "../types"

import parseDefuseAsset from "./parseDefuseAsset"
import {
  prepareCreateIntent1CrossChain,
  prepareCreateIntent1SingleChain,
} from "./intents"

export enum MapsEnum {
  NEAR_MAINNET = "near:mainnet",
  ETH_BASE = "eth:8453",
  BTC_MAINNET = "btc:mainnet",
}

export interface MapCreateIntentProps {
  tokenIn: CallRequestIntentProps["tokenIn"]
  tokenOut: CallRequestIntentProps["tokenOut"]
  selectedTokenIn: CallRequestIntentProps["selectedTokenIn"]
  selectedTokenOut: CallRequestIntentProps["selectedTokenOut"]
  intentId: CallRequestIntentProps["intentId"]
  blockHeight: number
  accountId: string | null
  accountFrom?: string
  accountTo?: string
  solverId?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MapCreateIntentResult = [number, any][]

/**
 * Function prepares a transaction call data depends on inputs for different intents.
 *
 * @param {Type} inputs - Swap parameters within tokenIn, tokenOut, selectedTokenIn, selectedTokenOut and intentId.
 * @returns {ReturnType} - Array with transaction call data.
 *
 * Additional Notes:
 * - Use Near chain ids - mainnet or testnet.
 * - Use EVM chain ids - "1" or other.
 * - Use TON chain ids - "1100" or other.
 * - Use Solana chain ids - mainnet or other.
 */
export const mapCreateIntentTransactionCall = (
  inputs: MapCreateIntentProps
): MapCreateIntentResult => {
  const from = parseDefuseAsset(inputs.selectedTokenIn.defuseAssetId)
  const fromNetworkId = `${from?.blockchain}:${from?.network}` as MapsEnum
  const to = parseDefuseAsset(inputs.selectedTokenOut.defuseAssetId)
  const toNetworkId = `${to?.blockchain}:${to?.network}` as MapsEnum

  switch (fromNetworkId) {
    case MapsEnum.NEAR_MAINNET:
      // Notes: In future each map will have not only one intent,
      //        as example here `[[INDEXER.INTENT_0, tx],...,[INDEXER.INTENT_N, tx_N]]`
      switch (toNetworkId) {
        case MapsEnum.NEAR_MAINNET:
          return [[INDEXER.INTENT_1, prepareCreateIntent1SingleChain(inputs)]]
        case MapsEnum.ETH_BASE:
          return [[INDEXER.INTENT_1, prepareCreateIntent1CrossChain(inputs)]]
        case MapsEnum.BTC_MAINNET:
          return [[INDEXER.INTENT_1, prepareCreateIntent1CrossChain(inputs)]]
        default:
          return []
      }
    case MapsEnum.ETH_BASE:
      return [[INDEXER.INTENT_1, prepareCreateIntent1CrossChain(inputs)]]
    default:
      return []
  }
}
