import { setup } from "xstate"

export const queryQuoteMachine = setup({
  types: {
    input: {} as {
      tokensIn: string[]
      tokensOut: string[]
      amountIn: bigint
      balances: Record<string, bigint>
    },
    output: {} as {
      quoteHashes: string[]
      expirationTime: number
      totalAmountOut: bigint
      amountsOut: Record<string, bigint>
    },
  },
}).createMachine({})
