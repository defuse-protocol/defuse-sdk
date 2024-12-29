import { isBaseToken } from "src/utils"
import { reverseAssetNetworkAdapter } from "src/utils/adapters"
import { assert } from "src/utils/assert"
import { parseUnits } from "src/utils/parse"
import { type ActorRef, type Snapshot, fromTransition } from "xstate"
import type { BlockchainEnum } from "../../types"
import type {
  BaseTokenInfo,
  SupportedChainName,
  UnifiedTokenInfo,
} from "../../types/base"

export type Fields = Array<Exclude<keyof State, "parentRef">>
const fields: Fields = ["tokenIn", "blockchain", "parsedAmount", "amount"]

export type ParentEvents = {
  type: "DEPOSIT_FORM_FIELDS_CHANGED"
  fields: Fields
}
type ParentActor = ActorRef<Snapshot<unknown>, ParentEvents>

export type Events =
  | {
      type: "DEPOSIT_FORM.UPDATE_TOKEN"
      params: {
        token: BaseTokenInfo | UnifiedTokenInfo
      }
    }
  | {
      type: "DEPOSIT_FORM.UPDATE_BLOCKCHAIN"
      params: {
        network: BlockchainEnum
      }
    }
  | {
      type: "DEPOSIT_FORM.UPDATE_AMOUNT"
      params: {
        amount: string
      }
    }

export type State = {
  parentRef: ParentActor
  tokenIn: BaseTokenInfo | UnifiedTokenInfo | null
  blockchain: SupportedChainName | null
  parsedAmount: bigint | null
  amount: string
}

export const depositFormReducer = fromTransition(
  (state, event: Events) => {
    let newState = state
    const eventType = event.type
    switch (eventType) {
      case "DEPOSIT_FORM.UPDATE_TOKEN": {
        newState = {
          ...state,
          tokenIn: event.params.token,
          blockchain: null,
          parsedAmount: null,
          amount: "",
        }
        break
      }
      case "DEPOSIT_FORM.UPDATE_BLOCKCHAIN": {
        const blockchain = reverseAssetNetworkAdapter[event.params.network]
        const tokenIn = state.tokenIn
          ? getDepositTokenWithFallback(state.tokenIn, blockchain)
          : null
        newState = {
          ...state,
          blockchain,
          tokenIn,
        }
        break
      }
      case "DEPOSIT_FORM.UPDATE_AMOUNT": {
        const tokenIn = state.tokenIn
        assert(tokenIn != null, "Token in not found")
        const amount = event.params.amount
        const parsedAmount = parseUnits(amount, tokenIn.decimals)
        newState = {
          ...state,
          parsedAmount,
          amount,
        }
        break
      }
      default:
        event satisfies never
        return state
    }

    const changedFields: Fields = []
    for (const key of fields) {
      if (newState[key] !== state[key]) {
        changedFields.push(key)
      }
    }
    if (changedFields.length > 0) {
      state.parentRef.send({
        type: "DEPOSIT_FORM_FIELDS_CHANGED",
        fields: changedFields,
      })
    }

    return newState
  },
  ({
    input,
  }: {
    input: {
      parentRef: ParentActor
    }
  }): State => {
    return {
      parentRef: input.parentRef,
      tokenIn: null,
      blockchain: null,
      parsedAmount: null,
      amount: "",
    }
  }
)

function getDepositTokenWithFallback(
  tokenIn: BaseTokenInfo | UnifiedTokenInfo,
  chainName: string | null
): BaseTokenInfo {
  if (isBaseToken(tokenIn)) {
    return tokenIn
  }

  if (chainName != null) {
    const selectToken = tokenIn.groupedTokens.find(
      (token) => token.chainName === chainName
    )
    if (selectToken != null) {
      return selectToken
    }
  }

  const selectToken = tokenIn.groupedTokens[0]
  assert(selectToken != null, "Token out not found")
  return selectToken
}
