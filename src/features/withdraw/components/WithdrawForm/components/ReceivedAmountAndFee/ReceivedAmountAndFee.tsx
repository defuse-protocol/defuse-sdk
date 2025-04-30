import { Flex, Skeleton, Text } from "@radix-ui/themes"
import { clsx } from "clsx"
import { useMemo } from "react"
import { TooltipInfo } from "../../../../../../components/TooltipInfo"
import type { WithdtrawalFee } from "../../../../../../services/withdrawService"
import type { TokenValue } from "../../../../../../types/base"
import { formatTokenValue } from "../../../../../../utils/format"

export const ReceivedAmountAndFee = ({
  fee,
  totalAmountReceived,
  symbol,
  isLoading,
}: {
  fee: WithdtrawalFee
  totalAmountReceived: TokenValue | null
  symbol: string
  isLoading: boolean
}) => {
  const { tag: feeTag, value: feeValue } = fee
  const feeError = feeTag === "err"

  const fee_ = useMemo<string>(() => {
    if (totalAmountReceived == null) {
      return "-"
    }

    if (feeError) {
      return "Fee is Unknown"
    }

    return formatTokenValue(feeValue.amount, feeValue.decimals)
  }, [totalAmountReceived, feeValue, feeError])

  const receivedAmount = useMemo<string>(() => {
    if (totalAmountReceived == null) {
      return "-"
    }

    return formatTokenValue(
      totalAmountReceived.amount,
      totalAmountReceived.decimals
    )
  }, [totalAmountReceived])

  const zeroFee = fee_ === "0"

  return (
    <>
      <Flex justify="between" px="2">
        <Text size="1" weight="medium" color="gray">
          Received amount
        </Text>
        <Text size="1" weight="bold">
          {isLoading ? <Skeleton>100.000000</Skeleton> : receivedAmount}
          {` ${symbol}`}
        </Text>
      </Flex>

      <Flex
        justify="between"
        px="2"
        className={clsx({ "text-green-a11": zeroFee && !feeError })}
      >
        <Text
          size="1"
          weight="medium"
          color={!zeroFee || feeError ? "gray" : undefined}
          className={clsx({ "text-green-a11": zeroFee && !feeError })}
        >
          Fee
        </Text>

        <Text size="1" weight="bold">
          {isLoading ? (
            <Skeleton>100.000</Skeleton>
          ) : feeError ? (
            <TooltipInfo
              icon={
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-gray-11">{fee_}</span>
                  <div className="w-3 h-3 bg-[url('/static/images/process.gif')] bg-no-repeat bg-contain" />
                </div>
              }
            >
              Error happened while getting fee.
            </TooltipInfo>
          ) : (
            `${fee_}`
          )}
          {feeError ? null : ` ${symbol}`}
        </Text>
      </Flex>
    </>
  )
}
