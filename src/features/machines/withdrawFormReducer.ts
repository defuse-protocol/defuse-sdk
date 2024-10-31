import { fromTransition } from "xstate"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../../types/base"
import { isBaseToken } from "../../utils"
import { assert } from "../../utils/assert"

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
        parsedAmount: bigint
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
        parsedAmount: bigint
      }
    }
  | {
      type: "WITHDRAW_FORM.RECIPIENT"
      params: {
        recipient: string
      }
    }

type State = {
  tokenIn: BaseTokenInfo | UnifiedTokenInfo
  tokenOut: BaseTokenInfo
  amount: string
  parsedAmount: bigint
  recipient: string
}

export const withdrawFormReducer = fromTransition(
  (state, event: Events) => {
    const eventType = event.type
    switch (eventType) {
      case "WITHDRAW_FORM.UPDATE_TOKEN": {
        return {
          ...state,
          parsedAmount: event.params.parsedAmount,
          tokenIn: event.params.token,
          tokenOut: getWithdrawTokenWithFallback(
            event.params.token,
            state.tokenOut.chainName
          ),
        }
      }
      case "WITHDRAW_FORM.UPDATE_BLOCKCHAIN": {
        return {
          ...state,
          tokenOut: getWithdrawTokenWithFallback(
            state.tokenIn,
            event.params.blockchain
          ),
        }
      }
      case "WITHDRAW_FORM.UPDATE_AMOUNT": {
        return {
          ...state,
          parsedAmount: event.params.parsedAmount,
          amount: event.params.amount,
        }
      }
      case "WITHDRAW_FORM.RECIPIENT": {
        return {
          ...state,
          recipient: event.params.recipient,
        }
      }
      default: {
        event satisfies never
        return state
      }
    }
  },
  ({
    input,
  }: { input: { tokenIn: BaseTokenInfo | UnifiedTokenInfo } }): State => {
    return {
      tokenIn: input.tokenIn,
      tokenOut: getWithdrawTokenWithFallback(input.tokenIn, null),
      amount: "",
      parsedAmount: 0n,
      recipient: "",
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
