import type { CheckedState } from "@radix-ui/react-checkbox"
import { InfoCircledIcon } from "@radix-ui/react-icons"
import {
  Checkbox,
  Flex,
  Text,
  Tooltip,
  useThemeContext,
} from "@radix-ui/themes"
import clsx from "clsx"
import { formatTokenValue } from "../../../utils/format"
import styles from "./styles.module.css"

export interface BlockMultiBalancesProps {
  balance: bigint
  decimals: number
  withNativeSupport?: boolean
  nativeSupportChecked?: CheckedState
  handleIncludeNativeToSwap?: (checked: CheckedState) => void
  handleClick?: () => void
  disabled?: boolean
  className?: string
}

export const BlockMultiBalances = ({
  balance,
  decimals,
  withNativeSupport,
  nativeSupportChecked = false,
  handleIncludeNativeToSwap,
  handleClick,
  disabled,
  className,
}: BlockMultiBalancesProps) => {
  const active = balance > 0n && !disabled
  const { accentColor } = useThemeContext()

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
          {withNativeSupport && (
            <div className={styles.nativeSupport}>
              <Checkbox
                size="1"
                checked={nativeSupportChecked ?? false}
                onCheckedChange={handleIncludeNativeToSwap ?? (() => {})}
                color={accentColor}
              />
              <Text size="1" className={styles.nativeSupportText}>
                Use Native
              </Text>
              <Tooltip content="Your NEAR balance will be automatically wrapped to wNEAR if your wNEAR balance isn't sufficient for the swap">
                <InfoCircledIcon />
              </Tooltip>
            </div>
          )}
        </button>
      </Flex>
    </Flex>
  )
}
