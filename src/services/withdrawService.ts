import { computeTotalBalance } from "src/utils/tokenUtils"
import { type ActorRefFrom, waitFor } from "xstate"
import { settings } from "../config/settings"
import { NEP141_STORAGE_TOKEN } from "../constants"
import type {
  QuoteInput,
  backgroundQuoterMachine,
} from "../features/machines/backgroundQuoterMachine"
import type {
  BalanceMapping,
  depositedBalanceMachine,
} from "../features/machines/depositedBalanceMachine"
import type { poaBridgeInfoActor } from "../features/machines/poaBridgeInfoActor"
import { getPOABridgeInfo } from "../features/machines/poaBridgeInfoActor"
import {
  type NEP141StorageRequirement,
  calcWithdrawAmount,
} from "../features/machines/swapIntentMachine"
import type { State as WithdrawFormContext } from "../features/machines/withdrawFormReducer"
import type { BaseTokenInfo, UnifiedTokenInfo } from "../types/base"
import { assert } from "../utils/assert"
import { isBaseToken, isNativeToken } from "../utils/token"
import { getNEP141StorageRequired } from "./nep141StorageService"
import {
  type AggregatedQuote,
  isAggregatedQuoteEmpty,
  queryQuoteExactOut,
} from "./quoteService"

interface SwapRequirement {
  swapParams: QuoteInput
  swapQuote: AggregatedQuote
}

export type PreparationOutput =
  | {
      tag: "ok"
      value: {
        directWithdrawAvailable: bigint
        swap: SwapRequirement | null
        nep141Storage: NEP141StorageRequirement | null
        receivedAmount: bigint
      }
    }
  | {
      tag: "err"
      value:
        | {
            reason:
              | "ERR_BALANCE_FETCH"
              | "ERR_BALANCE_MISSING"
              | "ERR_BALANCE_INSUFFICIENT"
              | "ERR_NEP141_STORAGE"
              | "ERR_CANNOT_FETCH_POA_BRIDGE_INFO"
              | "ERR_CANNOT_FETCH_QUOTE"
              | "ERR_EMPTY_QUOTE"
          }
        | {
            reason: "ERR_AMOUNT_TOO_LOW"
            receivedAmount: bigint
            minWithdrawalAmount: bigint
            token: BaseTokenInfo
          }
    }

export async function prepareWithdraw(
  {
    formValues,
    depositedBalanceRef,
    poaBridgeInfoRef,
    backgroundQuoteRef,
  }: {
    formValues: WithdrawFormContext
    depositedBalanceRef: ActorRefFrom<typeof depositedBalanceMachine>
    poaBridgeInfoRef: ActorRefFrom<typeof poaBridgeInfoActor>
    backgroundQuoteRef: ActorRefFrom<typeof backgroundQuoterMachine>
  },
  { signal }: { signal: AbortSignal }
): Promise<PreparationOutput> {
  const balances = await getBalances({ depositedBalanceRef }, { signal })
  if (balances.tag === "err") {
    return balances
  }

  const balanceSufficiency = checkBalanceSufficiency({
    formValues,
    balances: balances.value,
  })
  if (balanceSufficiency.tag === "err") {
    return balanceSufficiency
  }

  const breakdown = getWithdrawBreakdown({
    formValues,
    balances: balances.value,
  })
  if (breakdown.tag === "err") {
    return breakdown
  }

  const { directWithdrawAvailable, swapNeeded } = breakdown.value

  let swapRequirement: null | SwapRequirement = null
  if (swapNeeded.amount > 0n) {
    const swapParams = {
      amountIn: swapNeeded.amount,
      tokensIn: swapNeeded.tokens,
      tokenOut: formValues.tokenOut,
      balances: balances.value,
    }

    const swapQuote = await new Promise<AggregatedQuote>((resolve) => {
      backgroundQuoteRef.send({
        type: "NEW_QUOTE_INPUT",
        params: swapParams,
      })

      const sub = backgroundQuoteRef.on("NEW_QUOTE", (event) => {
        sub.unsubscribe()
        resolve(event.params.quote)
      })
    })

    swapRequirement = {
      swapParams,
      swapQuote,
    }
  }

  if (swapRequirement && isAggregatedQuoteEmpty(swapRequirement.swapQuote)) {
    return { tag: "err", value: { reason: "ERR_EMPTY_QUOTE" } }
  }

  const nep141Storage = await determineNEP141StorageRequirement(
    { formValues },
    { signal }
  )
  if (nep141Storage.tag === "err") {
    return nep141Storage
  }

  const minWithdrawal = await getMinWithdrawalAmount(
    {
      formValues,
      poaBridgeInfoRef,
    },
    { signal }
  )

  const receivedAmount = calcWithdrawAmount(
    swapRequirement?.swapQuote ?? null,
    nep141Storage.value,
    directWithdrawAvailable
  )

  if (receivedAmount < minWithdrawal) {
    return {
      tag: "err",
      value: {
        reason: "ERR_AMOUNT_TOO_LOW",
        receivedAmount,
        minWithdrawalAmount: minWithdrawal,
        token: formValues.tokenOut,
      },
    }
  }

  return {
    tag: "ok",
    value: {
      directWithdrawAvailable,
      swap: swapRequirement,
      nep141Storage: nep141Storage.value,
      receivedAmount,
    },
  }
}

async function determineNEP141StorageRequirement(
  {
    formValues,
  }: {
    formValues: WithdrawFormContext
  },
  {
    signal,
  }: {
    signal: AbortSignal
  }
): Promise<
  | { tag: "ok"; value: NEP141StorageRequirement | null }
  | {
      tag: "err"
      value: {
        reason:
          | "ERR_NEP141_STORAGE"
          | "ERR_EMPTY_QUOTE"
          | "ERR_CANNOT_FETCH_QUOTE"
      }
    }
> {
  // We withdraw unwrapped near so no storage deposit is required for withdrawal of NEAR
  if (formValues.tokenOut.address === "wrap.near") {
    return { tag: "ok", value: null }
  }

  const nep141StorageRequired = await checkNEP141StorageRequirements({
    formValues,
  })
  if (nep141StorageRequired.tag === "err") {
    return nep141StorageRequired
  }

  if (nep141StorageRequired.value === 0n) {
    return { tag: "ok", value: null }
  }

  if (
    formValues.tokenOut.defuseAssetId === NEP141_STORAGE_TOKEN.defuseAssetId
  ) {
    return {
      tag: "ok",
      value: {
        type: "no_swap_needed",
        requiredStorageNEAR: nep141StorageRequired.value,
        quote: null,
      },
    }
  }

  try {
    const nep141StorageQuote = await queryQuoteExactOut(
      {
        tokenIn: formValues.tokenOut.defuseAssetId,
        tokenOut: NEP141_STORAGE_TOKEN.defuseAssetId,
        exactAmountOut: nep141StorageRequired.value,
        /**
         * We expect user to finish the transaction in specific timeframe and
         * don't want to update the storage quote, as adds more complexity to code.
         */
        minDeadlineMs: settings.maxQuoteMinDeadlineMs,
      },
      { signal }
    )
    if (isAggregatedQuoteEmpty(nep141StorageQuote)) {
      return { tag: "err", value: { reason: "ERR_EMPTY_QUOTE" } }
    }
    return {
      tag: "ok",
      value: {
        type: "swap_needed",
        requiredStorageNEAR: nep141StorageRequired.value,
        quote: nep141StorageQuote,
      },
    }
  } catch (err) {
    console.error(
      new Error("Cannot fetch NEP141 storage quote", { cause: err })
    )
    return { tag: "err", value: { reason: "ERR_CANNOT_FETCH_QUOTE" } }
  }
}

async function getMinWithdrawalAmount(
  {
    formValues,
    poaBridgeInfoRef,
  }: {
    formValues: WithdrawFormContext
    poaBridgeInfoRef: ActorRefFrom<typeof poaBridgeInfoActor>
  },
  { signal }: { signal: AbortSignal }
): Promise<bigint> {
  if (formValues.tokenOut.chainName === "near") {
    return 1n
  }

  const poaBridgeInfoState = await waitFor(
    poaBridgeInfoRef,
    (state) => state.matches("success"),
    { signal } // todo: add timeout and error handling
  )

  // Check minimum withdrawal amount
  const poaBridgeInfo = getPOABridgeInfo(
    poaBridgeInfoState,
    formValues.tokenOut
  )
  assert(poaBridgeInfo != null, "poaBridgeInfo is null")

  return poaBridgeInfo.minWithdrawal
}

function checkBalanceSufficiency({
  formValues,
  balances,
}: {
  formValues: WithdrawFormContext
  balances: BalanceMapping
}):
  | { tag: "ok" }
  | {
      tag: "err"
      value: { reason: "ERR_BALANCE_INSUFFICIENT" | "ERR_BALANCE_MISSING" }
    } {
  assert(formValues.parsedAmount != null, "parsedAmount is null")

  const totalBalance = computeTotalBalance(formValues.tokenIn, balances)

  if (totalBalance == null) {
    return { tag: "err", value: { reason: "ERR_BALANCE_MISSING" } }
  }

  if (formValues.parsedAmount > totalBalance) {
    return { tag: "err", value: { reason: "ERR_BALANCE_INSUFFICIENT" } }
  }

  return { tag: "ok" }
}

async function getBalances(
  {
    depositedBalanceRef,
  }: {
    depositedBalanceRef: ActorRefFrom<typeof depositedBalanceMachine>
  },
  { signal }: { signal: AbortSignal }
): Promise<
  | { tag: "ok"; value: BalanceMapping }
  | { tag: "err"; value: { reason: "ERR_BALANCE_FETCH" } }
> {
  let balances = depositedBalanceRef.getSnapshot().context.balances
  if (Object.keys(balances).length === 0) {
    depositedBalanceRef.send({ type: "REQUEST_BALANCE_REFRESH" })
    const state = await waitFor(
      depositedBalanceRef,
      (state) => state.matches({ authenticated: "idle" }),
      { signal } // todo: add timeout and error handling
    )
    balances = state.context.balances
  }

  return {
    tag: "ok",
    value: balances,
  }
}

async function checkNEP141StorageRequirements({
  formValues,
}: {
  formValues: WithdrawFormContext
}): Promise<
  | { tag: "ok"; value: bigint }
  | { tag: "err"; value: { reason: "ERR_NEP141_STORAGE" } }
> {
  assert(formValues.parsedRecipient != null, "parsedRecipient is null")

  const nep141StorageRequired = await getNEP141StorageRequired({
    token: formValues.tokenOut,
    userAccountId: formValues.parsedRecipient,
  })

  if (nep141StorageRequired.tag === "err") {
    return { tag: "err", value: { reason: "ERR_NEP141_STORAGE" } }
  }

  return nep141StorageRequired
}

function getWithdrawBreakdown({
  formValues,
  balances,
}: {
  formValues: WithdrawFormContext
  balances: BalanceMapping
}):
  | {
      tag: "ok"
      value: {
        directWithdrawAvailable: bigint
        swapNeeded: {
          tokens: BaseTokenInfo[]
          amount: bigint
        }
      }
    }
  | { tag: "err"; value: { reason: "ERR_BALANCE_MISSING" } } {
  assert(formValues.parsedAmount != null, "parsedAmount is null")

  const requiredSwap = getRequiredSwapAmount(
    formValues.tokenIn,
    formValues.tokenOut,
    formValues.parsedAmount,
    balances
  )

  if (requiredSwap == null) {
    return { tag: "err", value: { reason: "ERR_BALANCE_MISSING" } }
  }

  if (requiredSwap.swapParams == null) {
    return {
      tag: "ok",
      value: {
        directWithdrawAvailable: requiredSwap.directWithdrawalAmount,
        swapNeeded: {
          tokens: [],
          amount: 0n,
        },
      },
    }
  }

  return {
    tag: "ok",
    value: {
      directWithdrawAvailable: requiredSwap.directWithdrawalAmount,
      swapNeeded: {
        tokens: requiredSwap.swapParams.tokensIn,
        amount: requiredSwap.swapParams.amountIn,
      },
    },
  }
}

function getRequiredSwapAmount(
  tokenIn: UnifiedTokenInfo | BaseTokenInfo,
  tokenOut: BaseTokenInfo,
  totalAmountIn: bigint,
  balances: Record<BaseTokenInfo["defuseAssetId"], bigint>
) {
  const underlyingTokensIn = isBaseToken(tokenIn)
    ? [tokenIn]
    : // Deduplicate tokens by defuseAssetId
      Array.from(
        new Map(tokenIn.groupedTokens.map((t) => [t.defuseAssetId, t])).values()
      )

  /**
   * It is crucial to know balances of involved tokens, otherwise we can't
   * make informed decisions.
   */
  if (
    underlyingTokensIn.some((t) => balances[t.defuseAssetId] == null) ||
    balances[tokenOut.defuseAssetId] == null
  ) {
    return null
  }

  /**
   * We want to swap only tokens that are not `tokenOut`.
   *
   * For example, user wants to swap USDC to USDC@Solana, we will quote for:
   * - USDC@Near → USDC@Solana
   * - USDC@Base → USDC@Solana
   * - USDC@Ethereum → USDC@Solana
   * We skip from quote:
   * - USDC@Solana → USDC@Solana
   */
  const tokensIn = underlyingTokensIn.filter(
    (t) => tokenOut.defuseAssetId !== t.defuseAssetId
  )

  /**
   * Some portion of the `tokenOut` balance is already available and doesn’t
   * require swapping.
   *
   * For example, in a swap USDC → USDC@Solana, any existing USDC@Solana
   * balance is directly counted towards the total output, reducing the amount
   * we need to quote for.
   */
  let swapAmount = totalAmountIn
  if (underlyingTokensIn.length !== tokensIn.length) {
    const tokenOutBalance = balances[tokenOut.defuseAssetId]
    // Help Typescript
    assert(tokenOutBalance != null, "Token out balance is missing")
    swapAmount -= min(tokenOutBalance, swapAmount)
  }

  return {
    swapParams:
      swapAmount > 0n
        ? { tokensIn, tokenOut, amountIn: swapAmount, balances }
        : null,
    directWithdrawalAmount: totalAmountIn - swapAmount,
    tokenOut,
  }
}

function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}
