import { Flex, Text } from "@radix-ui/themes"
import clsx from "clsx"
import { formatTokenValue } from "../../../utils/format"

export interface BlockMultiBalancesProps {
  balance: bigint
  decimals: number
  handleClick?: () => void
  disabled?: boolean
  className?: string
}

export const BlockMultiBalances = ({
  balance,
  decimals,
  handleClick,
  disabled,
  className,
}: BlockMultiBalancesProps) => {
  const active = balance > 0n && !disabled
  return (
    <Flex gap="1" asChild className={className}>
      <Flex asChild align="center" gap="1">
        <button type="button" onClick={handleClick} disabled={!active}>
          <div
            className={clsx(
              "w-4 h-4  [mask-image:url(/static/icons/wallet_no_active.svg)] bg-no-repeat bg-contain",
              active ? "bg-accent-800" : "bg-gray-600/90"
            )}
          />
          <Text
            size="1"
            className={clsx(
              "px-2 py-0.5 rounded-full font-bold",
              active
                ? "bg-accent-a200 text-accent-900"
                : "bg-gray-300/50 text-gray-600"
            )}
          >
            {formatTokenValue(balance, decimals, {
              min: 0.0001,
              fractionDigits: 4,
            })}
          </Text>
        </button>
      </Flex>
    </Flex>
  )
}
