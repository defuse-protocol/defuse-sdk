import { InfoCircledIcon } from "@radix-ui/react-icons"
import { Text, useThemeContext } from "@radix-ui/themes"
import clsx from "clsx"
import { useId } from "react"
import { useFormContext } from "react-hook-form"
import { BlockMultiBalances } from "../../../../components/Block/BlockMultiBalances"
import { ButtonCustom } from "../../../../components/Button/ButtonCustom"
import { TooltipInfo } from "../../../../components/TooltipInfo"
import { useTokensUsdPrices } from "../../../../hooks/useTokensUsdPrices"
import type { BaseTokenInfo } from "../../../../types/base"
import type { BlockchainEnum } from "../../../../types/interfaces"
import type { SwappableToken } from "../../../../types/swap"
import { reverseAssetNetworkAdapter } from "../../../../utils/adapters"
import { formatTokenValue, formatUsdAmount } from "../../../../utils/format"
import getTokenUsdPrice from "../../../../utils/getTokenUsdPrice"
import { RESERVED_NEAR_BALANCE } from "../../../machines/getBalanceMachine"
import { DepositResult } from "../DepositResult"
import { DepositUIMachineContext } from "../DepositUIMachineProvider"
import { DepositWarning } from "../DepositWarning"
import { TokenAmountInputCard } from "./TokenAmountInputCard"
import type { DepositFormValues } from "./index"
import { renderDepositHint } from "./renderDepositHint"

export type ActiveDepositProps = {
  network: BlockchainEnum
  token: BaseTokenInfo
  minDepositAmount: bigint | null
}

export function ActiveDeposit({
  network,
  token,
  minDepositAmount,
}: ActiveDepositProps) {
  const { setValue, watch } = useFormContext<DepositFormValues>()

  const {
    amount,
    parsedAmount,
    depositOutput,
    preparationOutput,
    balance,
    isLoading,
  } = DepositUIMachineContext.useSelector((snapshot) => {
    const amount = snapshot.context.depositFormRef.getSnapshot().context.amount
    const parsedAmount =
      snapshot.context.depositFormRef.getSnapshot().context.parsedAmount
    const preparationOutput = snapshot.context.preparationOutput
    return {
      amount,
      parsedAmount,
      depositOutput: snapshot.context.depositOutput,
      preparationOutput: snapshot.context.preparationOutput,
      balance:
        preparationOutput?.tag === "ok"
          ? preparationOutput.value.balance
          : null,
      isLoading:
        snapshot.matches("submittingNearTx") ||
        snapshot.matches("submittingEVMTx") ||
        snapshot.matches("submittingSolanaTx") ||
        snapshot.matches("submittingTurboTx"),
    }
  })

  const balanceInsufficient =
    balance != null
      ? isInsufficientBalance(amount, balance, token, network)
      : null

  const isDepositAmountHighEnough =
    minDepositAmount != null && parsedAmount !== null && parsedAmount > 0n
      ? parsedAmount >= minDepositAmount
      : true

  const handleSetMaxValue = async () => {
    if (token == null || balance == null) return
    const amountToFormat = formatTokenValue(balance, token.decimals)
    setValue("amount", amountToFormat)
  }

  const inputId = useId()

  const { data: tokensUsdPriceData } = useTokensUsdPrices()
  const usdAmountToDeposit = getTokenUsdPrice(amount, token, tokensUsdPriceData)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <label htmlFor={inputId} className="font-bold text-label text-sm">
          Enter amount
        </label>

        <TokenAmountInputCard
          inputSlot={
            <TokenAmountInputCard.Input
              id={inputId}
              name="amount"
              value={watch("amount")}
              onChange={(value) => setValue("amount", value.target.value)}
              aria-labelledby={inputId}
            />
          }
          tokenSlot={<TokenAmountInputCard.DisplayToken token={token} />}
          balanceSlot={
            <Balance
              balance={balance}
              token={token}
              onClick={handleSetMaxValue}
            />
          }
          priceSlot={
            <TokenAmountInputCard.DisplayPrice>
              {usdAmountToDeposit != null
                ? formatUsdAmount(usdAmountToDeposit)
                : null}
            </TokenAmountInputCard.DisplayPrice>
          }
        />
      </div>

      <DepositWarning depositWarning={depositOutput || preparationOutput} />

      <ButtonCustom
        size="lg"
        disabled={
          !watch("amount") || balanceInsufficient || !isDepositAmountHighEnough
        }
        isLoading={isLoading}
      >
        {renderDepositButtonText(
          watch("amount") === "",
          watch("amount") >= "0" &&
            (balanceInsufficient !== null ? balanceInsufficient : false),
          network,
          token,
          minDepositAmount,
          isDepositAmountHighEnough,
          isLoading
        )}
      </ButtonCustom>

      {renderDepositHint(network, minDepositAmount, token)}

      <DepositResult
        chainName={reverseAssetNetworkAdapter[network]}
        depositResult={depositOutput}
      />
    </div>
  )
}

function Balance({
  balance,
  token,
  onClick,
}: {
  balance: bigint | null
  token: BaseTokenInfo
  onClick: () => void
}) {
  const { accentColor } = useThemeContext()

  return (
    <div className="flex items-center gap-1">
      <BlockMultiBalances
        balance={balance ?? 0n}
        decimals={token.decimals}
        handleClick={onClick}
        disabled={balance === 0n}
        className={clsx("!static", balance == null && "invisible")}
      />

      {token.address === "wrap.near" && (
        <TooltipInfo
          icon={
            <Text asChild color={accentColor}>
              <InfoCircledIcon />
            </Text>
          }
        >
          Combined balance of NEAR and wNEAR.
          <br /> NEAR will be automatically wrapped to wNEAR
          <br /> if your wNEAR balance isn't sufficient for the swap.
          <br />
          Note that to cover network fees, we reserve
          {` ${formatTokenValue(RESERVED_NEAR_BALANCE, token.decimals)} NEAR`}
          <br /> in your wallet.
        </TooltipInfo>
      )}
    </div>
  )
}

function renderDepositButtonText(
  isAmountEmpty: boolean,
  isBalanceInsufficient: boolean,
  network: BlockchainEnum | null,
  token: SwappableToken | null,
  minDepositAmount: bigint | null,
  isDepositAmountHighEnough: boolean,
  isLoading: boolean
) {
  if (isLoading) {
    return "Processing..."
  }
  if (isAmountEmpty) {
    return "Enter amount"
  }
  if (!isDepositAmountHighEnough && minDepositAmount != null && token != null) {
    return `Minimal amount to deposit is ${formatTokenValue(minDepositAmount, token.decimals)} ${token.symbol}`
  }
  if (isBalanceInsufficient) {
    return "Insufficient balance"
  }
  if (!!network && !!token) {
    return "Deposit"
  }
  return !network && !token ? "Select asset first" : "Select network"
}

function isInsufficientBalance(
  formAmount: string,
  balance: bigint,
  derivedToken: BaseTokenInfo,
  network: BlockchainEnum | null
): boolean | null {
  if (!network) {
    return null
  }

  const balanceToFormat = formatTokenValue(balance, derivedToken.decimals)
  return Number.parseFloat(formAmount) > Number.parseFloat(balanceToFormat)
}
