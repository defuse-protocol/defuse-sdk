import { InfoCircledIcon } from "@radix-ui/react-icons"
import { Text, useThemeContext } from "@radix-ui/themes"
import { useFormContext } from "react-hook-form"
import { BlockMultiBalances } from "../../../../components/Block/BlockMultiBalances"
import { ButtonCustom } from "../../../../components/Button/ButtonCustom"
import { TooltipInfo } from "../../../../components/TooltipInfo"
import type { BaseTokenInfo } from "../../../../types/base"
import type { BlockchainEnum } from "../../../../types/interfaces"
import type { SwappableToken } from "../../../../types/swap"
import { reverseAssetNetworkAdapter } from "../../../../utils/adapters"
import { formatTokenValue } from "../../../../utils/format"
import { RESERVED_NEAR_BALANCE } from "../../../machines/getBalanceMachine"
import { DepositResult } from "../DepositResult"
import { DepositUIMachineContext } from "../DepositUIMachineProvider"
import { TokenAmountInputCard } from "./TokenAmountInputCard"
import type { DepositFormValues } from "./index"

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

  const { amount, parsedAmount, depositOutput, balance, isLoading } =
    DepositUIMachineContext.useSelector((snapshot) => {
      const amount =
        snapshot.context.depositFormRef.getSnapshot().context.amount
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="font-bold text-gray-800 text-sm">Enter amount</div>
        <TokenAmountInputCard
          inputSlot={
            <TokenAmountInputCard.Input
              name="amount"
              value={watch("amount")}
              onChange={(value) => setValue("amount", value.target.value)}
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
              {/* biome-ignore lint/nursery/useConsistentCurlyBraces: <explanation> */}
              {/* tbd */ ""}
            </TokenAmountInputCard.DisplayPrice>
          }
        />
      </div>

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

      {minDepositAmount != null && (
        <div className="flex flex-col gap-3.5 font-medium text-gray-600 text-xs">
          <div className="flex justify-between">
            <div>Minimum deposit</div>
            <div className="text-gray-800">
              {/* biome-ignore lint/nursery/useConsistentCurlyBraces: space is needed here */}
              {formatTokenValue(minDepositAmount, token.decimals)}{" "}
              {token.symbol}
            </div>
          </div>
        </div>
      )}

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
      {balance != null && (
        <BlockMultiBalances
          balance={balance}
          decimals={token.decimals}
          handleClick={() => onClick()}
          disabled={balance === 0n}
          className="!static"
        />
      )}

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
