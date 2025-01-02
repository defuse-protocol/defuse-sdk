import { type ActorRef, type Snapshot, fromTransition } from "xstate"
import type {
  BaseTokenInfo,
  SupportedChainName,
  UnifiedTokenInfo,
} from "../../types/base"
import { assert } from "../../utils/assert"
import { isBaseToken } from "../../utils/token"
import { validateAddress } from "../../utils/validateAddress"

export type Fields = Array<Exclude<keyof State, "parentRef">>
const fields: Fields = [
  "tokenIn",
  "tokenOut",
  "parsedAmount",
  "parsedRecipient",
  "parsedDestinationMemo",
]

export type ParentEvents = {
  type: "WITHDRAW_FORM_FIELDS_CHANGED"
  fields: Fields
}
type ParentActor = ActorRef<Snapshot<unknown>, ParentEvents>

export type Events =
  | {
      type: "WITHDRAW_FORM.UPDATE_TOKEN"
      params: {
        token: BaseTokenInfo | UnifiedTokenInfo
        /**
         * It's important to provide `parsedAmount` here, because the actual amount is
         * different because of the decimals. We cannot parse it here, because we don't
         * know what format UI uses to display the amount.
         */
        parsedAmount: bigint | null
      }
    }
  | {
      type: "WITHDRAW_FORM.UPDATE_BLOCKCHAIN"
      params: {
        blockchain: string
        /**
         * Don't need to provide `parsedAmount` here, because amount is not
         * expected to change when blockchain changes, because decimals for
         * a token are the same across all blockchains.
         */
      }
    }
  | {
      type: "WITHDRAW_FORM.UPDATE_AMOUNT"
      params: {
        amount: string
        parsedAmount: bigint | null
      }
    }
  | {
      type: "WITHDRAW_FORM.RECIPIENT"
      params: {
        recipient: string
      }
    }
  | {
      type: "WITHDRAW_FORM.UPDATE_DESTINATION_MEMO"
      params: {
        destinationMemo: string
      }
    }

export type State = {
  parentRef: ParentActor
  tokenIn: BaseTokenInfo | UnifiedTokenInfo
  tokenOut: BaseTokenInfo
  amount: string
  parsedAmount: bigint | null
  recipient: string
  parsedRecipient: string | null
  destinationMemo: string
  parsedDestinationMemo: string | null
}

export const withdrawFormReducer = fromTransition(
  (state, event: Events) => {
    let newState = state
    const eventType = event.type
    switch (eventType) {
      case "WITHDRAW_FORM.UPDATE_TOKEN": {
        const tokenOut = getWithdrawTokenWithFallback(
          event.params.token,
          state.tokenOut.chainName
        )
        newState = {
          ...state,
          parsedAmount: event.params.parsedAmount,
          tokenIn: event.params.token,
          tokenOut,
          recipient: "",
          parsedRecipient: null,
          destinationMemo: "",
          parsedDestinationMemo: null,
        }
        break
      }
      case "WITHDRAW_FORM.UPDATE_BLOCKCHAIN": {
        const tokenOut = getWithdrawTokenWithFallback(
          state.tokenIn,
          event.params.blockchain
        )
        newState = {
          ...state,
          tokenOut,
          recipient: "",
          parsedRecipient: null,
          destinationMemo: "",
          parsedDestinationMemo: null,
        }
        break
      }
      case "WITHDRAW_FORM.UPDATE_AMOUNT": {
        newState = {
          ...state,
          parsedAmount: event.params.parsedAmount,
          amount: event.params.amount,
        }
        break
      }
      case "WITHDRAW_FORM.RECIPIENT": {
        const recipient = event.params.recipient
        const parsedRecipient = getParsedRecipient(recipient, state.tokenOut)
        newState = {
          ...state,
          recipient,
          parsedRecipient,
        }
        break
      }
      case "WITHDRAW_FORM.UPDATE_DESTINATION_MEMO": {
        newState = {
          ...state,
          destinationMemo: event.params.destinationMemo,
          parsedDestinationMemo: parseDestinationMemo(
            event.params.destinationMemo,
            state.tokenOut.chainName
          ),
        }
        break
      }
      default: {
        event satisfies never
        return state
      }
    }

    const changedFields: Fields = []
    for (const key of fields) {
      if (newState[key] !== state[key]) {
        changedFields.push(key)
      }
    }
    if (changedFields.length > 0) {
      state.parentRef.send({
        type: "WITHDRAW_FORM_FIELDS_CHANGED",
        fields: changedFields,
      })
    }

    return newState
  },
  ({
    input,
  }: {
    input: { parentRef: ParentActor; tokenIn: BaseTokenInfo | UnifiedTokenInfo }
  }): State => {
    return {
      parentRef: input.parentRef,
      tokenIn: input.tokenIn,
      tokenOut: getWithdrawTokenWithFallback(input.tokenIn, null),
      amount: "",
      parsedAmount: null,
      recipient: "",
      parsedRecipient: null,
      destinationMemo: "",
      parsedDestinationMemo: null,
    }
  }
)

function getWithdrawTokenWithFallback(
  tokenIn: BaseTokenInfo | UnifiedTokenInfo,
  chainName: string | null
): BaseTokenInfo {
  if (isBaseToken(tokenIn)) {
    return tokenIn
  }

  if (chainName != null) {
    const tokenOut = tokenIn.groupedTokens.find(
      (token) => token.chainName === chainName
    )
    if (tokenOut != null) {
      return tokenOut
    }
  }

  const tokenOut = tokenIn.groupedTokens[0]
  assert(tokenOut != null, "Token out not found")
  return tokenOut
}

function getParsedRecipient(
  recipient: string,
  tokenOut: BaseTokenInfo
): string | null {
  if (!validateAddress(recipient, tokenOut.chainName)) {
    return null
  }

  return recipient
}

export function parseDestinationMemo(
  memo: string,
  chainName: SupportedChainName
): string | null {
  if (chainName !== "xrpledger") return null
  if (memo.trim() === "") return null

  const num = Number(memo.trim())
  if (!Number.isInteger(num) || num < 0 || num > 4294967295) return null

  return num.toString()
}
