import { InfoCircledIcon } from "@radix-ui/react-icons"
import { Text, useThemeContext } from "@radix-ui/themes"
import { useFormContext } from "react-hook-form"
import { BlockMultiBalances } from "../../../../components/Block/BlockMultiBalances"
import { ButtonCustom } from "../../../../components/Button/ButtonCustom"
import { Input } from "../../../../components/Input"
import { TooltipInfo } from "../../../../components/TooltipInfo"
import type { BaseTokenInfo } from "../../../../types/base"
import type { BlockchainEnum } from "../../../../types/interfaces"
import type { SwappableToken } from "../../../../types/swap"
import { reverseAssetNetworkAdapter } from "../../../../utils/adapters"
import { formatTokenValue } from "../../../../utils/format"
import { isBaseToken } from "../../../../utils/token"
import { RESERVED_NEAR_BALANCE } from "../../../machines/getBalanceMachine"
import { DepositResult } from "../DepositResult"
import { DepositUIMachineContext } from "../DepositUIMachineProvider"
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
  const { accentColor } = useThemeContext()
  const snapshot = DepositUIMachineContext.useSelector((snapshot) => snapshot)

  const { amount, parsedAmount, depositOutput, balance } =
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
    <>
      <Input
        name="amount"
        value={watch("amount")}
        onChange={(value) => setValue("amount", value)}
        type="text"
        inputMode="decimal"
        pattern="[0-9]*[.]?[0-9]*"
        autoComplete="off"
        placeholder="0"
        ref={(ref) => {
          if (ref) {
            ref.focus()
          }
        }}
        className="pb-16"
        slotRight={
          <div className="flex items-center gap-2 flex-row absolute right-5 bottom-5">
            {token && isBaseToken(token) && token.address === "wrap.near" && (
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
                {` ${formatTokenValue(
                  RESERVED_NEAR_BALANCE,
                  token.decimals
                )} NEAR`}
                <br /> in your wallet.
              </TooltipInfo>
            )}
            {balance != null && token != null && (
              <BlockMultiBalances
                balance={balance}
                decimals={token.decimals}
                handleClick={() => handleSetMaxValue()}
                disabled={balance === 0n}
                className="!static flex items-center justify-center"
              />
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-4 mt-4">
        <ButtonCustom
          size="lg"
          disabled={
            !watch("amount") ||
            balanceInsufficient ||
            !isDepositAmountHighEnough
          }
          isLoading={
            snapshot.matches("submittingNearTx") ||
            snapshot.matches("submittingEVMTx") ||
            snapshot.matches("submittingSolanaTx") ||
            snapshot.matches("submittingTurboTx")
          }
        >
          {renderDepositButtonText(
            watch("amount") >= "0" &&
              (balanceInsufficient !== null ? balanceInsufficient : false),
            network,
            token,
            minDepositAmount,
            isDepositAmountHighEnough
          )}
        </ButtonCustom>
      </div>

      <DepositResult
        chainName={reverseAssetNetworkAdapter[network]}
        depositResult={depositOutput}
      />
    </>
  )
}

function renderDepositButtonText(
  isBalanceInsufficient: boolean,
  network: BlockchainEnum | null,
  token: SwappableToken | null,
  minDepositAmount: bigint | null,
  isDepositAmountHighEnough: boolean
) {
  if (!isDepositAmountHighEnough && minDepositAmount != null && token != null) {
    return `Minimal amount to deposit is ${formatTokenValue(minDepositAmount, token.decimals)} ${token.symbol}`
  }
  if (isBalanceInsufficient) {
    return "Insufficient Balance"
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
