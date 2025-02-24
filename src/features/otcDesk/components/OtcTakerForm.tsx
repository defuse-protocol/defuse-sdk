import { useQuery } from "@tanstack/react-query"
import clsx from "clsx"
import { providers } from "near-api-js"
import { BlockMultiBalances } from "../../../components/Block/BlockMultiBalances"
import { ButtonCustom } from "../../../components/Button/ButtonCustom"
import { useTokensUsdPrices } from "../../../hooks/useTokensUsdPrices"
import { getDepositedBalances } from "../../../services/defuseBalanceService"
import type { ChainType } from "../../../types/deposit"
import { assert } from "../../../utils/assert"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import { formatTokenValue, formatUsdAmount } from "../../../utils/format"
import getTokenUsdPrice from "../../../utils/getTokenUsdPrice"
import { computeTotalBalanceDifferentDecimals } from "../../../utils/tokenUtils"
import { TokenAmountInputCard } from "../../deposit/components/DepositForm/TokenAmountInputCard"
import { useConfirmSwap } from "../hooks/useConfirmSwap"
import type { SignMessage } from "../types/sharedTypes"
import type { TradeTerms } from "../utils/deriveTradeTerms"

export type OtcTakerFormProps = {
  tradeTerms: TradeTerms
  userAddress: string | null | undefined
  userChainType: ChainType | null | undefined
  signMessage: SignMessage
  protocolFee: number
}

export function OtcTakerForm({
  tradeTerms,
  userAddress,
  userChainType,
  protocolFee,
}: OtcTakerFormProps) {
  const totalAmountIn = computeTotalBalanceDifferentDecimals(
    tradeTerms.tokenIn,
    tradeTerms.takerTokenDiff,
    { strict: false }
  )
  assert(totalAmountIn)

  const totalAmountOut = computeTotalBalanceDifferentDecimals(
    tradeTerms.tokenOut,
    tradeTerms.takerTokenDiff,
    { strict: false }
  )
  assert(totalAmountOut)

  const { data: tokensUsdPriceData } = useTokensUsdPrices()
  const usdAmountIn = getTokenUsdPrice(
    formatTokenValue(-totalAmountIn.amount, totalAmountIn.decimals),
    tradeTerms.tokenIn,
    tokensUsdPriceData
  )
  const usdAmountOut = getTokenUsdPrice(
    formatTokenValue(totalAmountOut.amount, totalAmountOut.decimals),
    tradeTerms.tokenOut,
    tokensUsdPriceData
  )

  const userId =
    userAddress != null && userChainType != null
      ? userAddressToDefuseUserId(userAddress, userChainType)
      : null

  const { data: balances } = useQuery({
    queryKey: [
      "deposited_balance_token_in_out",
      userId,
      Object.keys(tradeTerms.takerTokenDiff),
    ],
    queryFn: async () => {
      assert(userId != null)

      const balances = await getDepositedBalances(
        userId,
        Object.keys(tradeTerms.takerTokenDiff),
        new providers.JsonRpcProvider({
          url: "https://nearrpc.aurora.dev",
        })
      )

      const tokenInBalance = computeTotalBalanceDifferentDecimals(
        tradeTerms.tokenIn,
        balances,
        { strict: false }
      )

      const tokenOutBalance = computeTotalBalanceDifferentDecimals(
        tradeTerms.tokenOut,
        balances,
        { strict: false }
      )

      return {
        tokenIn: tokenInBalance,
        tokenOut: tokenOutBalance,
      }
    },
    enabled: userId != null,
  })

  useConfirmSwap({
    takerTokenDiff: tradeTerms.takerTokenDiff,
    takerUserId: userId,
    tokenIn: tradeTerms.tokenIn,
    protocolFee,
  })

  return (
    <div>
      <div>Complete swap</div>
      <div>Pay the specified amount to finalize the transaction.</div>

      <div>
        <div className="font-bold text-label text-sm">Pay</div>

        <TokenAmountInputCard
          inputSlot={
            <TokenAmountInputCard.Input
              readOnly
              name="amount"
              value={formatTokenValue(
                -totalAmountIn.amount,
                totalAmountIn.decimals
              )}
            />
          }
          tokenSlot={
            <TokenAmountInputCard.DisplayToken token={tradeTerms.tokenIn} />
          }
          balanceSlot={
            <BlockMultiBalances
              balance={balances?.tokenIn?.amount ?? 0n}
              decimals={balances?.tokenIn?.decimals ?? 0}
              className={clsx(
                "!static",
                balances?.tokenIn == null && "invisible"
              )}
            />
          }
          priceSlot={
            <TokenAmountInputCard.DisplayPrice>
              {usdAmountIn !== null && usdAmountIn > 0
                ? formatUsdAmount(usdAmountIn)
                : null}
            </TokenAmountInputCard.DisplayPrice>
          }
        />
      </div>

      <div>
        <div className="font-bold text-label text-sm">Receive</div>

        <TokenAmountInputCard
          inputSlot={
            <TokenAmountInputCard.Input
              readOnly
              name="amount"
              value={formatTokenValue(
                totalAmountOut.amount,
                totalAmountOut.decimals
              )}
            />
          }
          tokenSlot={
            <TokenAmountInputCard.DisplayToken token={tradeTerms.tokenOut} />
          }
          balanceSlot={
            <BlockMultiBalances
              balance={balances?.tokenOut?.amount ?? 0n}
              decimals={balances?.tokenOut?.decimals ?? 0}
              className={clsx(
                "!static",
                balances?.tokenOut == null && "invisible"
              )}
            />
          }
          priceSlot={
            <TokenAmountInputCard.DisplayPrice>
              {usdAmountOut !== null && usdAmountOut > 0
                ? formatUsdAmount(usdAmountOut)
                : null}
            </TokenAmountInputCard.DisplayPrice>
          }
        />
      </div>

      <ButtonCustom size="lg">Confirm swap</ButtonCustom>
    </div>
  )
}
