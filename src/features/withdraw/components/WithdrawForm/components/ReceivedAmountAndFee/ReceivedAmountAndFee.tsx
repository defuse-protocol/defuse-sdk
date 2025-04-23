import { Flex, Skeleton, Text } from "@radix-ui/themes"
import { clsx } from "clsx"
import { useMemo } from "react"
import type { TokenValue } from "../../../../../../types/base"
import { formatTokenValue } from "../../../../../../utils/format"

export const ReceivedAmountAndFee = ({
  fee,
  totalAmountReceived,
  symbol,
  isLoading,
}: {
  fee: TokenValue | null
  totalAmountReceived: TokenValue | null
  symbol: string
  isLoading: boolean
}) => {
  const fee_ = useMemo(() => {
    return fee != null ? formatTokenValue(fee.amount, fee.decimals) : "-"
  }, [fee])

  const receivedAmount = useMemo<string>(() => {
    if (totalAmountReceived == null) {
      return "-"
    }

    let amountReceived = totalAmountReceived.amount

    if (fee !== null) {
      amountReceived -= fee.amount
    }

    return formatTokenValue(amountReceived, totalAmountReceived.decimals)
  }, [totalAmountReceived, fee])

  const zeroFee = fee?.amount === 0n

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
        className={clsx({ "text-green-a11": zeroFee })}
      >
        <Text
          size="1"
          weight="medium"
          color={!zeroFee ? "gray" : undefined}
          className={clsx({ "text-green-a11": zeroFee })}
        >
          Fee
        </Text>

        <Text size="1" weight="bold">
          {isLoading ? <Skeleton>100.000</Skeleton> : fee_}
          {` ${symbol}`}
        </Text>
      </Flex>
    </>
  )
}
