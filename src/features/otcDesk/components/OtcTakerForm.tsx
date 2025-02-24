import { useQuery } from "@tanstack/react-query"
import clsx from "clsx"
import { providers } from "near-api-js"
import { BlockMultiBalances } from "../../../components/Block/BlockMultiBalances"
import { ButtonCustom } from "../../../components/Button/ButtonCustom"
import type { SignerCredentials } from "../../../core/formatters"
import { useTokensUsdPrices } from "../../../hooks/useTokensUsdPrices"
import { getDepositedBalances } from "../../../services/defuseBalanceService"
import type { MultiPayload } from "../../../types/defuse-contracts-types"
import { assert } from "../../../utils/assert"
import { userAddressToDefuseUserId } from "../../../utils/defuse"
import { formatTokenValue, formatUsdAmount } from "../../../utils/format"
import getTokenUsdPrice from "../../../utils/getTokenUsdPrice"
import { computeTotalBalanceDifferentDecimals } from "../../../utils/tokenUtils"
import { TokenAmountInputCard } from "../../deposit/components/DepositForm/TokenAmountInputCard"
import { useOtcTakerConfirmTrade } from "../hooks/useOtcTakerConfirmTrade"
import { useOtcTakerPreparation } from "../hooks/useOtcTakerPreparation"
import type { SignMessage } from "../types/sharedTypes"
import type { TradeTerms } from "../utils/deriveTradeTerms"

export type OtcTakerFormProps = {
  makerMultiPayloadPlain: string | MultiPayload
  tradeTerms: TradeTerms
  signerCredentials: SignerCredentials | null
  signMessage: SignMessage
  protocolFee: number
  onSuccessTrade: (arg: { intentHashes: string[]; txHash: string }) => void
}

export function OtcTakerForm({
  makerMultiPayloadPlain,
  tradeTerms,
  protocolFee,
  signerCredentials,
  signMessage,
  onSuccessTrade,
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

  const signerId =
    signerCredentials != null
      ? userAddressToDefuseUserId(
          signerCredentials.credential,
          signerCredentials.credentialType
        )
      : null

  const { data: balances } = useQuery({
    queryKey: [
      "deposited_balance_token_in_out",
      signerId,
      Object.keys(tradeTerms.takerTokenDiff),
    ],
    queryFn: async () => {
      assert(signerId != null)

      const balances = await getDepositedBalances(
        signerId,
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
    enabled: signerId != null,
  })

  const preparation = useOtcTakerPreparation({
    tokenIn: tradeTerms.tokenIn,
    takerTokenDiff: tradeTerms.takerTokenDiff,
    protocolFee,
    takerId: signerId,
  })

  const confirmTradeMutation = useOtcTakerConfirmTrade({
    makerMultiPayloadPlain,
    signMessage,
    onSuccessTrade,
  })

  return (
    <div>
      <div>Complete swap</div>
      <div>Pay the specified amount to finalize the transaction.</div>

      {confirmTradeMutation.data?.match({
        ok: () => <div>Swapped!</div>,
        err: (err) => <div className="text-red-700">{err.reason}</div>,
      })}

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

      <ButtonCustom
        size="lg"
        type="button"
        onClick={() => {
          if (
            !confirmTradeMutation.isPending &&
            signerCredentials != null &&
            preparation.data != null &&
            preparation.data.isOk()
          ) {
            confirmTradeMutation.mutate({
              signerCredentials,
              preparation: preparation.data.unwrap(),
            })
          }
        }}
        isLoading={confirmTradeMutation.isPending}
      >
        {confirmTradeMutation.isPending
          ? "Confirm in your wallet..."
          : "Confirm swap"}
      </ButtonCustom>
    </div>
  )
}
