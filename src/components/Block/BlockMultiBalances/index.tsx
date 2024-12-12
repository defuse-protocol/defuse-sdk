import { Flex, Text } from "@radix-ui/themes"
import clsx from "clsx"
import { formatTokenValue } from "../../../utils/format"
import styles from "./styles.module.css"

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
    <Flex
      gap={"1"}
      asChild
      className={clsx(styles.balanceContainer, className)}
    >
      <Flex asChild align={"center"} gap={"1"}>
        <button type={"button"} onClick={handleClick} disabled={!active}>
          <div className={clsx(styles.icon, active && styles.activeIcon)} />
          <Text
            size={"1"}
            className={clsx(
              styles.balanceValue,
              active ? styles.balanceValueActive : styles.balanceValueInactive
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
